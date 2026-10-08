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
import com.financasponto.entity.TimeRecord;
import com.financasponto.entity.Usuario;
import com.financasponto.repository.UsuarioRepository;
import com.financasponto.utils.PunchTextParser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.Loader;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.util.*;

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
    private final UsuarioRepository usuarioRepository;
    private final com.financasponto.security.JwtUtil jwtUtil;

    @Value("${app.gmail.redirect-uri:https://pontonick.duckdns.org/api/gmail/callback}")
    private String redirectUri;

    private static final List<String> SCOPES = List.of(
            GmailScopes.GMAIL_READONLY
    );
    private static final GsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

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
    public String getAuthorizationUrl(Long uid, String syncFrom) {
        try {
            GoogleAuthorizationCodeFlow flow = buildFlow();
            String state = jwtUtil.generateStateToken(uid, syncFrom);
            String url = flow.newAuthorizationUrl()
                    .setRedirectUri(redirectUri)
                    .setState(state)
                    .build();
            return url;
        } catch (Exception e) {
            log.error("Erro ao gerar URL de autenticação: {}", e.getMessage());
            return null;
        }
    }

    /** Troca o código de autorização pelo token e salva. */
    public boolean exchangeCode(String code, String state) {
        try {
            io.jsonwebtoken.Claims claims = jwtUtil.validateStateTokenAndGetClaims(state);
            Long uid = claims.get("uid", Long.class);
            String syncFrom = claims.get("syncFrom", String.class);

            Usuario user = usuarioRepository.findById(uid)
                    .orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado"));

            GoogleAuthorizationCodeFlow flow = buildFlow();
            GoogleTokenResponse tokenResponse = flow.newTokenRequest(code)
                    .setRedirectUri(redirectUri)
                    .execute();
            
            String userIdStr = "user-" + uid;
            flow.createAndStoreCredential(tokenResponse, userIdStr);

            Credential credential = flow.loadCredential(userIdStr);
            NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
            Gmail service = new Gmail.Builder(httpTransport, JSON_FACTORY, credential)
                    .setApplicationName("FinançasPonto")
                    .build();
            Profile profile = service.users().getProfile("me").execute();

            user.setGmailEmail(profile.getEmailAddress());
            user.setGmailStatus("CONECTADO");
            user.setGmailSyncFrom(syncFrom);
            usuarioRepository.save(user);

            log.info("✅ Gmail autenticado com sucesso para o usuário {}", uid);
            return true;
        } catch (Exception e) {
            log.error("Erro ao trocar código: {}", e.getMessage());
            throw new RuntimeException("Falha na autenticação Gmail", e);
        }
    }

    public void disconnect(Usuario user) {
        try {
            GoogleAuthorizationCodeFlow flow = buildFlow();
            String userIdStr = "user-" + user.getId();
            Credential credential = flow.loadCredential(userIdStr);
            if (credential != null) {
                try {
                    NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();
                    com.google.api.client.http.GenericUrl url = new com.google.api.client.http.GenericUrl("https://oauth2.googleapis.com/revoke?token=" + credential.getRefreshToken());
                    httpTransport.createRequestFactory().buildPostRequest(url, null).execute();
                } catch (Exception e) {
                    log.warn("Não foi possível revogar token no Google para o usuário {}", user.getId());
                }
                flow.getCredentialDataStore().delete(userIdStr);
            }
            user.setGmailEmail(null);
            user.setGmailStatus("DESCONECTADO");
            user.setGmailSyncFrom(null);
            user.setGmailLastSync(null);
            usuarioRepository.save(user);
        } catch (Exception e) {
            log.error("Erro ao desconectar Gmail do usuário {}: {}", user.getId(), e.getMessage());
            throw new RuntimeException("Erro ao desconectar Gmail", e);
        }
    }

    private Gmail getGmailService(String userIdStr) throws Exception {
        GoogleAuthorizationCodeFlow flow = buildFlow();
        Credential credential = flow.loadCredential(userIdStr);
        if (credential == null || credential.getRefreshToken() == null) {
            throw new IllegalStateException("Gmail não autenticado para " + userIdStr);
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

    public int syncUser(Usuario user) {
        if (!"CONECTADO".equals(user.getGmailStatus())) return 0;
        try {
            Gmail service = getGmailService("user-" + user.getId());
            java.time.LocalDate syncFrom = null;
            if (user.getGmailSyncFrom() != null && !user.getGmailSyncFrom().isBlank()) {
                syncFrom = java.time.LocalDate.parse(user.getGmailSyncFrom());
            }
            String query = com.financasponto.utils.GmailQueryBuilder.buildIncrementalQuery(user.getGmailLastSync(), syncFrom);
            
            java.time.LocalDateTime syncStartTime = java.time.LocalDateTime.now(java.time.ZoneId.of("America/Sao_Paulo"));
            int processed = processMessagesForUser(service, user, query, false);
            
            user.setGmailLastSync(syncStartTime);
            usuarioRepository.save(user);
            return processed;
        } catch (Exception e) {
            handleSyncError(e, user);
            return 0;
        }
    }

    public int syncUserPeriod(Usuario user, java.time.LocalDate startDate, java.time.LocalDate endDate) throws Exception {
        if (!"CONECTADO".equals(user.getGmailStatus())) {
            throw new IllegalArgumentException("Usuário não está conectado ao Gmail");
        }
        try {
            Gmail service = getGmailService("user-" + user.getId());
            String query = com.financasponto.utils.GmailQueryBuilder.buildPeriodQuery(startDate, endDate);
            return processMessagesForUser(service, user, query, true);
        } catch (Exception e) {
            handleSyncError(e, user);
            throw e;
        }
    }

    private void handleSyncError(Exception e, Usuario user) {
        if (e instanceof com.google.api.client.auth.oauth2.TokenResponseException) {
            if ("invalid_grant".equals(((com.google.api.client.auth.oauth2.TokenResponseException) e).getDetails().getError())) {
                user.setGmailStatus("EXPIRED");
                usuarioRepository.save(user);
                log.warn("Token expirado/inválido para usuário {}", user.getId());
                return;
            }
        } else if (e instanceof IllegalStateException && e.getMessage().contains("não autenticado")) {
            user.setGmailStatus("EXPIRED");
            usuarioRepository.save(user);
            return;
        }
        log.error("Erro ao sincronizar usuário {}: {}", user.getId(), e.getMessage());
    }

    private int processMessagesForUser(Gmail service, Usuario user, String query, boolean syncHistory) throws Exception {
        int totalProcessed = 0;
        String pageToken = null;

        do {
            ListMessagesResponse response = service.users().messages()
                    .list("me")
                    .setQ(query)
                    .setPageToken(pageToken)
                    .execute();

            List<Message> messages = response.getMessages();
            if (messages == null || messages.isEmpty()) {
                break;
            }

            for (Message msgRef : messages) {
                if (timeRecordService.isAlreadyProcessed(msgRef.getId())) {
                    continue;
                }

                int maxRetries = 3;
                int retryCount = 0;
                boolean success = false;

                while (retryCount < maxRetries && !success) {
                    try {
                        Message message = service.users().messages()
                                .get("me", msgRef.getId())
                                .setFormat("full")
                                .execute();

                        String extracted = extractTextFromMessage(service, message);
                        PunchTextParser.ParsedPunch punch = PunchTextParser.parse(extracted);
                        if (punch != null) {
                            if (com.financasponto.utils.PunchOwnershipPolicy.isOwner(user, punch)) {
                                TimeRecord saved = timeRecordService.saveRecord(user,
                                        punch.timestamp(), punch.origin(), punch.online(),
                                        punch.hash(), message.getId(), extracted, syncHistory);
                                if (saved != null) totalProcessed++;
                            } else {
                                log.warn("Batida ignorada: não pertence ao usuário {}", user.getId());
                            }
                        }
                        success = true;
                    } catch (Exception e) {
                        log.warn("Erro ao processar email {} (tentativa {}/{}): {}", 
                                 msgRef.getId(), retryCount + 1, maxRetries, e.getMessage());
                        
                        if (e.getMessage() != null && e.getMessage().contains("rateLimitExceeded")) {
                            retryCount++;
                            if (retryCount < maxRetries) {
                                long backoff = 5000L * retryCount;
                                java.lang.Thread.sleep(backoff);
                            }
                        } else {
                            break; 
                        }
                    }
                }
                java.lang.Thread.sleep(syncHistory ? 1000 : 300);
            }
            pageToken = response.getNextPageToken();
        } while (pageToken != null);

        return totalProcessed;
    }

    private String extractTextFromMessage(Gmail service, Message message) throws Exception {
        if (message.getPayload() != null && message.getPayload().getParts() != null) {
            for (MessagePart part : message.getPayload().getParts()) {
                if (part.getFilename() != null && !part.getFilename().isEmpty()) {
                    String attachmentId = part.getBody().getAttachmentId();
                    if (attachmentId != null) {
                        MessagePartBody attachment = service.users().messages().attachments()
                                .get("me", message.getId(), attachmentId).execute();
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
}
