import React, { useState, useEffect, useRef } from 'react';
import { Check, Clock } from 'lucide-react';
import { BottomSheetModal } from './FeedbackProvider';

interface AndroidTimePickerModalProps {
  isOpen: boolean;
  initialTime?: string; // "08:00"
  title?: string;
  subtitle?: string;
  onConfirm: (time: string) => void;
  onClose: () => void;
}

const CLOCK_SIZE = 260;
const CENTER = CLOCK_SIZE / 2; // 130
const R_OUTER = 98;
const R_INNER = 64;

const outerHours = [0, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const innerHours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
const quickTimes = ['08:00', '09:00', '12:00', '13:00', '13:30', '17:00', '17:30', '18:00'];

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
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      const parts = (initialTime || '08:00').split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      setHour(isNaN(h) ? 8 : Math.max(0, Math.min(23, h)));
      setMinute(isNaN(m) ? 0 : Math.max(0, Math.min(59, m)));
      setMode('hour');
      isDraggingRef.current = false;
    }
  }, [isOpen, initialTime]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleConfirm();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (mode === 'hour') setHour((prev) => (prev + 1) % 24);
        else setMinute((prev) => (prev + 5) % 60);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (mode === 'hour') setHour((prev) => (prev - 1 + 24) % 24);
        else setMinute((prev) => (prev - 5 + 60) % 60);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, hour, minute]);

  const handleConfirm = () => {
    const formatted = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    onConfirm(formatted);
  };

  let pointerRadius = R_OUTER;
  let pointerAngleDeg = 0;

  if (mode === 'hour') {
    const isInner = innerHours.includes(hour);
    pointerRadius = isInner ? R_INNER : R_OUTER;
    const clockNumber = hour % 12;
    pointerAngleDeg = clockNumber * 30;
  } else {
    pointerRadius = R_OUTER;
    pointerAngleDeg = minute * 6;
  }

  const pointerAngleRad = (pointerAngleDeg - 90) * (Math.PI / 180);
  const pointerX = CENTER + pointerRadius * Math.cos(pointerAngleRad);
  const pointerY = CENTER + pointerRadius * Math.sin(pointerAngleRad);

  const updateFromPointer = (svgEl: SVGSVGElement, clientX: number, clientY: number) => {
    const rect = svgEl.getBoundingClientRect();
    const scale = rect.width > 0 ? rect.width / CLOCK_SIZE : 1;
    const clickX = (clientX - rect.left) / scale - CENTER;
    const clickY = (clientY - rect.top) / scale - CENTER;
    const dist = Math.sqrt(clickX * clickX + clickY * clickY);

    let deg = Math.atan2(clickY, clickX) * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;

    if (mode === 'hour') {
      const isInner = dist < (R_INNER + R_OUTER) / 2;
      const selectedNumber = Math.round(deg / 30) % 12;
      if (isInner) {
        const chosen = selectedNumber === 0 ? 12 : selectedNumber;
        setHour(chosen);
      } else {
        const chosen = selectedNumber === 0 ? 0 : selectedNumber + 12;
        setHour(chosen);
      }
    } else {
      const selectedMin = Math.round(deg / 6) % 60;
      setMinute(selectedMin);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    updateFromPointer(e.currentTarget, e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    updateFromPointer(e.currentTarget, e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    updateFromPointer(e.currentTarget, e.clientX, e.clientY);
    if (mode === 'hour') {
      window.setTimeout(() => {
        setMode('minute');
      }, 180);
    }
  };

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<Clock size={18} className="text-green" />}
      maxWidth={400}
      footer={
        <div className="modal-actions-row">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            <Check size={16} />
            Confirmar Horário
          </button>
        </div>
      }
    >
      {/* Big Android Digital Display */}
      <div className="timepicker-digital">
        <div className="timepicker-digit-col">
          <button
            type="button"
            onClick={() => setMode('hour')}
            className={`timepicker-digit-btn${mode === 'hour' ? ' active' : ''}`}
          >
            {hour.toString().padStart(2, '0')}
          </button>
          <span className={`timepicker-digit-label${mode === 'hour' ? ' active' : ''}`}>
            HORA
          </span>
        </div>

        <div className="timepicker-colon">:</div>

        <div className="timepicker-digit-col">
          <button
            type="button"
            onClick={() => setMode('minute')}
            className={`timepicker-digit-btn${mode === 'minute' ? ' active' : ''}`}
          >
            {minute.toString().padStart(2, '0')}
          </button>
          <span className={`timepicker-digit-label${mode === 'minute' ? ' active' : ''}`}>
            MINUTO
          </span>
        </div>
      </div>

      {/* Android Radial Clock Face with Pointer/Touch Drag */}
      <div className="timepicker-dial-wrap">
        <svg
          viewBox={`0 0 ${CLOCK_SIZE} ${CLOCK_SIZE}`}
          className="timepicker-svg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            isDraggingRef.current = false;
          }}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={CENTER - 8}
            fill="rgba(255, 255, 255, 0.03)"
            stroke="var(--border)"
            strokeWidth="1.5"
          />

          {mode === 'hour' && (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={R_INNER}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeDasharray="3,3"
            />
          )}

          <circle cx={CENTER} cy={CENTER} r={4} fill="var(--accent-green)" />

          <line
            x1={CENTER}
            y1={CENTER}
            x2={pointerX}
            y2={pointerY}
            stroke="var(--accent-green)"
            strokeWidth="2.5"
          />

          <circle
            cx={pointerX}
            cy={pointerY}
            r={16}
            fill="var(--accent-green)"
            filter="drop-shadow(0 2px 6px rgba(16, 185, 129, 0.5))"
          />

          {mode === 'hour' && (
            <>
              {outerHours.map((h, idx) => {
                const angleDeg = idx * 30;
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

              {innerHours.map((h, idx) => {
                const angleDeg = idx * 30;
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

          {mode === 'minute' && (
            <>
              {minutesList.map((m) => {
                const angleDeg = m * 6;
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

      {/* Quick Presets Bar (44x44px touch targets) */}
      <div className="timepicker-presets">
        <div className="timepicker-presets-top">
          <span className="timepicker-presets-label">Minutos rápidos:</span>
          <div className="timepicker-chips-row">
            {[':00', ':15', ':30', ':45'].map((minStr) => {
              const val = parseInt(minStr.replace(':', ''), 10);
              return (
                <button
                  key={minStr}
                  type="button"
                  onClick={() => setMinute(val)}
                  className={`timepicker-chip${minute === val ? ' active' : ''}`}
                >
                  {minStr}
                </button>
              );
            })}
          </div>
        </div>
        <span className="timepicker-presets-label">Atalhos de horário comercial:</span>
        <div className="timepicker-chips-row">
          {quickTimes.map((t) => {
            const [qh, qm] = t.split(':').map(Number);
            const isSelected = hour === qh && minute === qm;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setHour(qh);
                  setMinute(qm);
                }}
                className={`timepicker-chip${isSelected ? ' active' : ''}`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheetModal>
  );
};
