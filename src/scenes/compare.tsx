// 場面「compare」: 左右の比較
import React from 'react';
import type { CompareScene, CompareSide } from '../../content/types';
import { Glass, Icon, IconBadge, Smart } from '../components/ui';
import { alpha, CONTENT_BOTTOM, CONTENT_TOP, H, PAD, usePalette } from '../theme';
import { dropY, useAppear } from '../timing';
import { defineScene } from './define';

const SideCard: React.FC<{ side: CompareSide; dir: -1 | 1 }> = ({ side, dir }) => {
  const { C, SANS, tone } = usePalette();
  const p = useAppear(side.at);
  const tt = tone(side.tone);
  return (
    <div
      style={{ flex: 1, minWidth: 0, display: 'flex', opacity: p, transform: `translateX(${(1 - p) * 30 * dir}px)` }}
    >
      <Glass
        t={side.tone}
        active={0.6}
        style={{ flex: 1, padding: '38px 44px', display: 'flex', flexDirection: 'column', gap: 26 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          {side.icon ? <IconBadge name={side.icon} t={side.tone} size={76} glow={0.5} /> : null}
          <div>
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 900,
                fontSize: side.title.length > 14 ? 36 : 44,
                color: C.ink,
                lineHeight: 1.2,
              }}
            >
              <Smart text={side.title} t={side.tone} />
            </div>
            {side.sub ? (
              <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, color: tt.text, marginTop: 4 }}>
                <Smart text={side.sub} t={side.tone} />
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ height: 2, background: `linear-gradient(90deg, ${alpha(tt.main, 0x88 / 255)}, transparent)` }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {side.items.map((it, i) => (
            <SideItem key={i} text={it.text} at={it.at} k={i} t={side.tone} />
          ))}
        </div>
      </Glass>
    </div>
  );
};

const SideItem: React.FC<{ text: string; at: number; k: number; t: CompareSide['tone'] }> = ({ text, at, k, t }) => {
  const { C, SANS, tone } = usePalette();
  const p = useAppear(at, k * 6);
  const tt = tone(t);
  return (
    <div
      style={{
        display: 'flex',
        gap: 18,
        alignItems: 'flex-start',
        opacity: p,
        transform: `translateY(${dropY(p, 12)}px)`,
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 99,
          background: tt.main,
          marginTop: 16,
          flexShrink: 0,
          boxShadow: `0 0 12px ${tt.main}`,
        }}
      />
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 33, color: C.ink, lineHeight: 1.45 }}>
        <Smart text={text} t={t} />
      </div>
    </div>
  );
};

const Compare: React.FC<{ s: CompareScene }> = ({ s }) => {
  const { C, GRAD, SANS, tone } = usePalette();
  const v = useAppear(s.verdict?.at ?? 99);
  const vt = tone(s.verdict?.tone ?? 'violet');
  return (
    <div
      style={{
        position: 'absolute',
        left: PAD,
        right: PAD,
        top: CONTENT_TOP,
        bottom: H - CONTENT_BOTTOM,
        display: 'flex',
        flexDirection: 'column',
        gap: 30,
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: 40, alignItems: 'stretch', minHeight: s.verdict ? 470 : 600 }}>
        <SideCard side={s.left} dir={-1} />
        <SideCard side={s.right} dir={1} />
      </div>
      {s.verdict ? (
        <div style={{ opacity: v, transform: `translateY(${dropY(v, 16)}px)` }}>
          <div
            style={{
              borderRadius: 24,
              padding: 2,
              background: GRAD,
              boxShadow: `0 0 40px ${alpha(vt.main, 0x40 / 255)}`,
            }}
          >
            <div
              style={{
                borderRadius: 22,
                background: C.overlay,
                padding: '26px 38px',
                display: 'flex',
                alignItems: 'center',
                gap: 24,
              }}
            >
              <Icon name="check" size={44} color={vt.main} stroke={3} />
              <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: 36, color: C.ink, lineHeight: 1.4 }}>
                <Smart text={s.verdict.text} t={s.verdict.tone} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const compare = defineScene({ kind: 'compare', Component: Compare });
