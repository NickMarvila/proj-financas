import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface AndroidTimePickerModalProps {
  isOpen: boolean;
  initialTime?: string; // "08:00"
  title?: string;
  subtitle?: string;
  onConfirm: (time: string) => void;
  onClose: () => void;
}

export const AndroidTimePickerModal: React.FC<AndroidTimePickerModalProps> = ({
  isOpen,
  initialTime = '08:00',
  title = 'Selecionar Horário',
  subtitle,
  onConfirm,
  onClose,
}) => {
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [mode, setMode] = useState<'hour' | 'minute'>('hour');

  // Parse initialTime when opened
  useEffect(() => {
    if (isOpen) {
      const parts = (initialTime || '08:00').split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      setHour(isNaN(h) ? 8 : Math.max(0, Math.min(23, h)));
      setMinute(isNaN(m) ? 0 : Math.max(0, Math.min(59, m)));
      setMode('hour');
    }
  }, [isOpen, initialTime]);

  // Keyboard navigation (Enter = confirm, Esc = close)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (mode === 'hour') setHour(prev => (prev + 1) % 24);
        else setMinute(prev => (prev + 5) % 60);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (mode === 'hour') setHour(prev => (prev - 1 + 24) % 24);
        else setMinute(prev => (prev - 5 + 60) % 60);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, hour, minute]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const formatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onConfirm(formatted);
  };

  const handleHourClick = (h: number) => {
    setHour(h);
    // Android clock picker auto-advances to minute selection smoothly!
    setTimeout(() => {
      setMode('minute');
    }, 220);
  };

  const handleMinuteClick = (m: number) => {
    setMinute(m);
  };

  // Preset quick times
  const quickTimes = [
    '08:00', '09:00', '12:00', '13:00', '13:30', '17:00', '17:30', '18:00'
  ];

  // Radial geometry for 260px clock
  const CLOCK_SIZE = 260;
  const CENTER = CLOCK_SIZE / 2; // 130
  const R_OUTER = 98; // outer ring radius
  const R_INNER = 64; // inner ring radius

  // Hours: 12-hour positions for inner (1..12) and outer (00, 13..23)
  // Standard Android 24-hour Material TimePicker:
  // Outer circle: 00, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23 (step = 30 deg, 12 o'clock is 00)
  // Inner circle: 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 (step = 30 deg, 12 o'clock is 12)
  const outerHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  const innerHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  // Minutes: 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Calculate pointer coordinates
  let pointerRadius = R_OUTER;
  let pointerAngleDeg = 0;

  if (mode === 'hour') {
    const isInner = innerHours.includes(hour);
    pointerRadius = isInner ? R_INNER : R_OUTER;
    // Angle in degrees: 12 o'clock is 0 deg (or -90 from standard trig)
    const clockNumber = hour % 12; // 0..11, 0 is at 12 o'clock
    pointerAngleDeg = clockNumber * 30;
  } else {
    pointerRadius = R_OUTER;
    pointerAngleDeg = minute * 6; // 360 / 60 = 6 deg
  }

  const pointerAngleRad = (pointerAngleDeg - 90) * (Math.PI / 180);
  const pointerX = CENTER + pointerRadius * Math.cos(pointerAngleRad);
  const pointerY = CENTER + pointerRadius * Math.sin(pointerAngleRad);

  // Handle dial click/drag
  const handleDialClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - CENTER;
    const clickY = e.clientY - rect.top - CENTER;
    const dist = Math.sqrt(clickX * clickX + clickY * clickY);

    // Angle: atan2 returns -PI to PI where (1,0) is 0 rad.
    // 12 o'clock is (0, -1), which is -PI/2 (-90 deg).
    let deg = Math.atan2(clickY, clickX) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;

    if (mode === 'hour') {
      const isInner = dist < (R_INNER + R_OUTER) / 2;
      let selectedNumber = Math.round(deg / 30) % 12; // 0..11
      if (isInner) {
        // Inner circle: 12, 1..11
        const chosen = selectedNumber === 0 ? 12 : selectedNumber;
        handleHourClick(chosen);
      } else {
        // Outer circle: 00, 13..23
        const chosen = selectedNumber === 0 ? 0 : selectedNumber + 12;
        handleHourClick(chosen);
      }
    } else {
      // Minute: 0..59
      let selectedMin = Math.round(deg / 6) % 60;
      handleMinuteClick(selectedMin);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card"
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'rgba(15, 18, 28, 0.96)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.15)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header / Title */}
        <div
          style={{
            padding: '20px 24px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} style={{ color: 'var(--accent-green)' }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                {title}
              </h3>
            </div>
            {subtitle && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Big Android Digital Display */}
        <div
          style={{
            padding: '20px 24px 10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Hour display button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setMode('hour')}
                style={{
                  background: mode === 'hour' ? 'var(--accent-green-dim)' : 'rgba(255, 255, 255, 0.04)',
                  border: mode === 'hour' ? '2px solid var(--accent-green)' : '1px solid var(--border)',
                  color: mode === 'hour' ? 'var(--accent-green-light)' : 'var(--text-primary)',
                  borderRadius: '16px',
                  width: '90px',
                  height: '76px',
                  fontSize: '40px',
                  fontWeight: 700,
                  fontFamily: 'monospace, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: mode === 'hour' ? '0 0 15px rgba(16, 185, 129, 0.25)' : 'none',
                }}
              >
                {hour.toString().padStart(2, '0')}
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, color: mode === 'hour' ? 'var(--accent-green)' : 'var(--text-muted)', marginTop: 4, letterSpacing: '0.05em' }}>
                HORA
              </span>
            </div>

            <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 18 }}>
              :
            </div>

            {/* Minute display button */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setMode('minute')}
                style={{
                  background: mode === 'minute' ? 'var(--accent-green-dim)' : 'rgba(255, 255, 255, 0.04)',
                  border: mode === 'minute' ? '2px solid var(--accent-green)' : '1px solid var(--border)',
                  color: mode === 'minute' ? 'var(--accent-green-light)' : 'var(--text-primary)',
                  borderRadius: '16px',
                  width: '90px',
                  height: '76px',
                  fontSize: '40px',
                  fontWeight: 700,
                  fontFamily: 'monospace, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: mode === 'minute' ? '0 0 15px rgba(16, 185, 129, 0.25)' : 'none',
                }}
              >
                {minute.toString().padStart(2, '0')}
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, color: mode === 'minute' ? 'var(--accent-green)' : 'var(--text-muted)', marginTop: 4, letterSpacing: '0.05em' }}>
                MINUTO
              </span>
            </div>
          </div>
        </div>

        {/* Android Radial Clock Face */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px 0 16px',
            position: 'relative',
          }}
        >
          <svg
            width={CLOCK_SIZE}
            height={CLOCK_SIZE}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              touchAction: 'none',
            }}
            onClick={handleDialClick}
          >
            {/* Clock background plate */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={CENTER - 8}
              fill="rgba(255, 255, 255, 0.03)"
              stroke="var(--border)"
              strokeWidth="1.5"
            />

            {/* Inner ring track guide (when in hour mode) */}
            {mode === 'hour' && (
              <circle
                cx={CENTER}
                cy={CENTER}
                r={R_INNER}
                fill="none"
                stroke="rgba(255, 255, 255, 0.04)"
                strokeDasharray="3,3"
              />
            )}

            {/* Center Pivot Pin */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={4}
              fill="var(--accent-green)"
            />

            {/* Pointer Arm Hand */}
            <line
              x1={CENTER}
              y1={CENTER}
              x2={pointerX}
              y2={pointerY}
              stroke="var(--accent-green)"
              strokeWidth="2.5"
            />

            {/* Selected Number Highlight Disc on Hand's tip */}
            <circle
              cx={pointerX}
              cy={pointerY}
              r={16}
              fill="var(--accent-green)"
              filter="drop-shadow(0 2px 6px rgba(16, 185, 129, 0.5))"
            />

            {/* HOUR MODE NUMBERS */}
            {mode === 'hour' && (
              <>
                {/* Outer Ring: 00, 13..23 */}
                {outerHours.map((h, idx) => {
                  const angleDeg = idx * 30; // 0 is top
                  const angleRad = (angleDeg - 90) * (Math.PI / 180);
                  const x = CENTER + R_OUTER * Math.cos(angleRad);
                  const y = CENTER + R_OUTER * Math.sin(angleRad);
                  const isSelected = hour === h;

                  return (
                    <text
                      key={`outer-${h}`}
                      x={x}
                      y={y + 5}
                      textAnchor="middle"
                      fill={isSelected ? '#ffffff' : 'var(--text-secondary)'}
                      fontSize="13"
                      fontWeight={isSelected ? '700' : '500'}
                      style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
                    >
                      {h.toString().padStart(2, '0')}
                    </text>
                  );
                })}

                {/* Inner Ring: 12, 1..11 */}
                {innerHours.map((h, idx) => {
                  const angleDeg = idx * 30; // 0 is top (12)
                  const angleRad = (angleDeg - 90) * (Math.PI / 180);
                  const x = CENTER + R_INNER * Math.cos(angleRad);
                  const y = CENTER + R_INNER * Math.sin(angleRad);
                  const isSelected = hour === h;

                  return (
                    <text
                      key={`inner-${h}`}
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fill={isSelected ? '#ffffff' : 'var(--text-muted)'}
                      fontSize="12"
                      fontWeight={isSelected ? '700' : '500'}
                      style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
                    >
                      {h}
                    </text>
                  );
                })}
              </>
            )}

            {/* MINUTE MODE NUMBERS */}
            {mode === 'minute' && (
              <>
                {minutesList.map((m) => {
                  const angleDeg = m * 6; // 360 / 60
                  const angleRad = (angleDeg - 90) * (Math.PI / 180);
                  const x = CENTER + R_OUTER * Math.cos(angleRad);
                  const y = CENTER + R_OUTER * Math.sin(angleRad);
                  const isSelected = minute === m;

                  return (
                    <text
                      key={`min-${m}`}
                      x={x}
                      y={y + 5}
                      textAnchor="middle"
                      fill={isSelected ? '#ffffff' : 'var(--text-secondary)'}
                      fontSize="13"
                      fontWeight={isSelected ? '700' : '500'}
                      style={{ pointerEvents: 'none', transition: 'fill 0.15s' }}
                    >
                      {m.toString().padStart(2, '0')}
                    </text>
                  );
                })}
              </>
            )}
          </svg>
        </div>

        {/* Quick Desktop Presets Bar */}
        <div
          style={{
            padding: '8px 20px',
            borderTop: '1px solid var(--border)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              Atalhos de Horário Comercial:
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[':00', ':15', ':30', ':45'].map((minStr) => (
                <button
                  key={minStr}
                  type="button"
                  onClick={() => setMinute(parseInt(minStr.replace(':', ''), 10))}
                  style={{
                    background: minute === parseInt(minStr.replace(':', ''), 10) ? 'var(--accent-green-dim)' : 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border)',
                    color: minute === parseInt(minStr.replace(':', ''), 10) ? 'var(--accent-green-light)' : 'var(--text-secondary)',
                    borderRadius: '6px',
                    padding: '2px 6px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {minStr}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {quickTimes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  const [qh, qm] = t.split(':').map(Number);
                  setHour(qh);
                  setMinute(qm);
                }}
                style={{
                  background:
                    hour === parseInt(t.split(':')[0], 10) && minute === parseInt(t.split(':')[1], 10)
                      ? 'var(--accent-green-dim)'
                      : 'rgba(255, 255, 255, 0.04)',
                  border:
                    hour === parseInt(t.split(':')[0], 10) && minute === parseInt(t.split(':')[1], 10)
                      ? '1px solid var(--accent-green)'
                      : '1px solid var(--border)',
                  color:
                    hour === parseInt(t.split(':')[0], 10) && minute === parseInt(t.split(':')[1], 10)
                      ? 'var(--accent-green-light)'
                      : 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  fontSize: 12,
                  fontFamily: 'monospace, sans-serif',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            background: 'rgba(0, 0, 0, 0.3)',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)',
            }}
          >
            <Check size={16} />
            Confirmar Horário
          </button>
        </div>
      </div>
    </div>
  );
};
