package com.financasponto.service;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.*;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.client.util.store.FileDataStoreFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.GmailScopes;
import com.google.api.services.gmail.model.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.Loader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class GmailService {

    @Value("${app.gmail.user}")
    private String gmailUser;

    @Value("${app.gmail.credentials-path}")
    private String credentialsPath;

    @Value("${app.gmail.tokens-dir}")
    private String tokensDir;

    @Value("${app.gmail.poll-sender}")
    private String pollSender;

    private final TimeRecordService timeRecordService;

    private static final List<String> SCOPES = List.of(
            GmailScopes.GMAIL_READONLY,
            GmailScopes.GMAIL_MODIFY
    );
    private static final GsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();
    private static final String REDIRECT_URI = "http://localhost:8888/Callback";
    private static final DateTimeFormatter STAMP_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");

    private GoogleAuthorizationCodeFlow buildFlow() throws Exception {
        Path credFile = Paths.get(credentialsPath);
        if (!Files.exists(credFile)) {
            throw new FileNotFoundException("credentials.json não encontrado em: " + credentialsPath);
        }
        NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        GoogleClientSecrets clientSecrets = GoogleClientSecrets.load(JSON_FACTORY,
                new InputStreamReader(new FileInputStream(credFile.toFile())));
        return new GoogleAuthorizationCodeFlow.Builder(
                httpTransport, JSON_FACTORY, clientSecrets, SCOPES)
                .setDataStoreFactory(new FileDataStoreFactory(new File(tokensDir)))
                .setAccessType("offline")
                .build();
    }

    /** Retorna URL para o usuário autorizar no browser e obter o código. */
    public String getAuthorizationUrl() {
        try {
            GoogleAuthorizationCodeFlow flow = buildFlow();
            String url = flow.newAuthorizationUrl()
                    .setRedirectUri(REDIRECT_URI)
                    .build();
            log.info("\n\n========== AUTORIZAÇÃO GMAIL ==========\nAbra esta URL no navegador:\n{}\n=======================================\n", url);
            return url;
        } catch (Exception e) {
            log.error("Erro ao gerar URL de autenticação: {}", e.getMessage());
            return null;
        }
    }

    /** Troca o código de autorização pelo token e salva. */
    public boolean exchangeCode(String code) {
        try {
            GoogleAuthorizationCodeFlow flow = buildFlow();
            GoogleTokenResponse tokenResponse = flow.newTokenRequest(code)
                    .setRedirectUri(REDIRECT_URI)
                    .execute();
            flow.createAndStoreCredential(tokenResponse, "user");
            log.info("✅ Gmail autenticado com sucesso!");
            return true;
        } catch (Exception e) {
            log.error("Erro ao trocar código: {}", e.getMessage());
            return false;
        }
    }

    private Gmail getGmailService() throws Exception {
        GoogleAuthorizationCodeFlow flow = buildFlow();
        Credential credential = flow.loadCredential("user");
        if (credential == null || credential.getRefreshToken() == null) {
            String authUrl = getAuthorizationUrl();
            throw new IllegalStateException(
                "Gmail não autenticado. Acesse: POST /api/gmail/auth para obter a URL e depois POST /api/gmail/code com o código.");
        }
        NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
        return new Gmail.Builder(httpTransport, JSON_FACTORY, credential)
                .setApplicationName("FinançasPonto")
                .build();
    }

    public boolean isAuthenticated() {
        try {
            GoogleAuthorizationCodeFlow flow = buildFlow();
            Credential credential = flow.loadCredential("user");
            return credential != null && credential.getRefreshToken() != null;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean hasCredentials() {
        return Files.exists(Paths.get(credentialsPath));
    }

    public int pollAndProcess(boolean syncHistory, String afterDate) throws Exception {
        if (!hasCredentials()) {
            log.warn("credentials.json não encontrado, pulando polling Gmail");
            return 0;
        }
        int processed = 0;
        Gmail service = getGmailService();
        String query = "from:" + pollSender + (syncHistory ? "" : " is:unread");
        if (syncHistory && afterDate != null && !afterDate.isBlank()) {
            query += " after:" + afterDate.replace("-", "/"); // Gmail search uses YYYY/MM/DD
        }
        
        ListMessagesResponse response = service.users().messages()
                .list(gmailUser)
                .setQ(query)
                .execute();

        List<Message> messages = response.getMessages();
        if (messages == null || messages.isEmpty()) {
            log.debug("Nenhum e-mail novo de {}", pollSender);
            return 0;
        }

        for (Message msgRef : messages) {
            // Se já temos no banco, nem gasta cota da API perguntando pro Google o corpo do email!
            if (timeRecordService.isAlreadyProcessed(msgRef.getId())) {
                log.info("Email {} já processado, pulando leitura.", msgRef.getId());
                continue;
            }

            int maxRetries = 3;
            int retryCount = 0;
            boolean success = false;

            while (retryCount < maxRetries && !success) {
                try {
                    Message message = service.users().messages()
                            .get(gmailUser, msgRef.getId())
                            .setFormat("full")
                            .execute();

                    String extracted = extractTextFromMessage(service, message);
                    if (extracted != null) {
                        ParsedPunch punch = parsePunchFromText(extracted);
                        if (punch != null) {
                            timeRecordService.saveRecord(
                                    punch.timestamp(), punch.origin(), punch.online(),
                                    punch.hash(), message.getId(), extracted, syncHistory);
                            processed++;
                            
                            // Marcar como lido
                            ModifyMessageRequest markRead = new ModifyMessageRequest()
                                    .setRemoveLabelIds(List.of("UNREAD"));
                            service.users().messages().modify(gmailUser, message.getId(), markRead).execute();
                        }
                    }
                    success = true; // Message fully processed without exceptions
                } catch (Exception e) {
                    log.warn("Erro ao processar email {} (tentativa {}/{}): {}", 
                             msgRef.getId(), retryCount + 1, maxRetries, e.getMessage());
                    
                    if (e.getMessage() != null && e.getMessage().contains("rateLimitExceeded")) {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            long backoff = 5000L * retryCount;
                            log.info("Rate limit atingido. Aguardando {}ms antes de tentar novamente...", backoff);
                            java.lang.Thread.sleep(backoff);
                        }
                    } else {
                        // Se for outro erro, não é rate limit, interrompe as tentativas deste email
                        break; 
                    }
                }
            }
            // Anti Rate-Limit baseline (evitar Quota Exceeded 403)
            java.lang.Thread.sleep(syncHistory ? 1000 : 300);
        }
        return processed;
    }

    private String extractTextFromMessage(Gmail service, Message message) throws Exception {
        // Tentar extrair de anexos primeiro (PDF ou TXT)
        if (message.getPayload() != null && message.getPayload().getParts() != null) {
            for (MessagePart part : message.getPayload().getParts()) {
                if (part.getFilename() != null && !part.getFilename().isEmpty()) {
                    String attachmentId = part.getBody().getAttachmentId();
                    if (attachmentId != null) {
                        MessagePartBody attachment = service.users().messages().attachments()
                                .get(gmailUser, message.getId(), attachmentId).execute();
                        byte[] data = Base64.getUrlDecoder().decode(attachment.getData());

                        if (part.getFilename().toLowerCase().endsWith(".pdf")) {
                            return extractTextFromPdf(data);
                        } else {
                            return new String(data);
                        }
                    }
                }
            }
        }

        // Tentar corpo do e-mail
        return extractBodyText(message.getPayload());
    }

    private String extractBodyText(MessagePart part) {
        if (part == null) return null;
        if (part.getMimeType().equals("text/plain") && part.getBody() != null
                && part.getBody().getData() != null) {
            return new String(Base64.getUrlDecoder().decode(part.getBody().getData()));
        }
        if (part.getParts() != null) {
            for (MessagePart sub : part.getParts()) {
                String result = extractBodyText(sub);
                if (result != null) return result;
            }
        }
        return null;
    }

    private String extractTextFromPdf(byte[] pdfBytes) {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            return new PDFTextStripper().getText(doc);
        } catch (Exception e) {
            log.error("Erro ao extrair PDF: {}", e.getMessage());
            return null;
        }
    }

    private ParsedPunch parsePunchFromText(String text) {
        try {
            Pattern stampPattern = Pattern.compile("Marca[çc][aã]o:\\s*(\\d{2}/\\d{2}/\\d{4}\\s+\\d{2}:\\d{2}:\\d{2})");
            Pattern originPattern = Pattern.compile("Origem:\\s*(.+)");
            Pattern onlinePattern = Pattern.compile("Online:\\s*(Sim|N[aã]o|Yes|No)", Pattern.CASE_INSENSITIVE);
            Pattern hashPattern = Pattern.compile("Hash:\\s*([A-Za-z0-9+/=]+)");

            Matcher stampMatcher = stampPattern.matcher(text);
            if (!stampMatcher.find()) {
                log.warn("Data/hora de marcação não encontrada no texto");
                return null;
            }

            LocalDateTime timestamp = LocalDateTime.parse(stampMatcher.group(1).trim(), STAMP_FMT);

            String origin = "SISTEMA";
            Matcher originMatcher = originPattern.matcher(text);
            if (originMatcher.find()) origin = originMatcher.group(1).trim();

            Boolean online = null;
            Matcher onlineMatcher = onlinePattern.matcher(text);
            if (onlineMatcher.find()) online = onlineMatcher.group(1).equalsIgnoreCase("Sim");

            String hash = null;
            Matcher hashMatcher = hashPattern.matcher(text);
            if (hashMatcher.find()) hash = hashMatcher.group(1).trim();

            return new ParsedPunch(timestamp, origin, online, hash);
        } catch (Exception e) {
            log.error("Erro ao parsear comprovante: {}", e.getMessage());
            return null;
        }
    }

    public record ParsedPunch(LocalDateTime timestamp, String origin, Boolean online, String hash) {}
}
