// 場面「flow」: 流れの図（箱と矢印）
import type React from 'react';
import type { FlowScene, Tone } from '../../engine/core/schema';
import { type Box, Edge } from '../components/edge';
import { fitSize } from '../components/fit';
import { Glass, IconBadge, Smart } from '../components/ui';
import { alpha, usePalette } from '../theme';
import { dropY, useAppear, useFocus } from '../timing';
import { TYPE } from '../video.config';
import { defineScene } from './define';

const NodeCard: React.FC<{
  label: string;
  sub?: string | undefined;
  icon?: Parameters<typeof IconBadge>[0]['name'] | undefined;
  t: Tone;
  box: Box;
  at: number;
  mono?: boolean | undefined;
  focus: number;
}> = ({ label, sub, icon, t, box, at, mono, focus }) => {
  const { C, MONO, SANS } = usePalette();
  const p = useAppear(at);
  // 箱の幅に収まるよう、名前の文字を小さくする（札の下限まで）
  const avail = box.w - 44 - (icon ? 72 : 0);
  const labelSize = fitSize(label, {
    role: 'label',
    max: mono ? TYPE.label.nodeLabelMono : TYPE.label.nodeLabel,
    width: avail,
    fontFamily: mono ? MONO : SANS,
    fontWeight: mono ? 700 : 900,
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - box.w / 2,
        top: box.y - box.h / 2,
        width: box.w,
        height: box.h,
        opacity: p * (focus < 0 ? 0.42 : 1),
        transform: `translateY(${dropY(p, 18)}px) scale(${focus > 0 ? 1.04 : 1})`,
      }}
    >
      <Glass
        t={t}
        active={focus > 0 ? 1 : 0}
        style={{
          width: '100%',
          height: '100%',
          padding: '0 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxSizing: 'border-box',
        }}
      >
        {icon ? <IconBadge name={icon} t={t} size={56} glow={focus > 0 ? 0.8 : 0} /> : null}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              fontFamily: mono ? MONO : SANS,
              fontWeight: mono ? 700 : 900,
              fontSize: labelSize,
              color: C.ink,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
          {sub ? (
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: TYPE.label.nodeSub,
                color: C.sub,
                lineHeight: 1.35,
              }}
            >
              <Smart text={sub} t={t} />
            </div>
          ) : null}
        </div>
      </Glass>
    </div>
  );
};

const Flow: React.FC<{ s: FlowScene }> = ({ s }) => {
  const f = useFocus(s.focus);
  const boxes = new Map(s.nodes.map((n) => [n.key, { x: n.x, y: n.y, w: n.w ?? 320, h: n.h ?? 118 } as Box]));
  const focusOf = (key: string) => (!f ? 0 : f.keys.includes(key) ? 1 : -1);
  const sameAt = new Map<number, number>();
  return (
    <>
      {s.groups?.map((g, i) => (
        <GroupBox key={i} {...g} />
      ))}
      {s.edges.map((e, i) => {
        const k = sameAt.get(e.at) ?? 0;
        sameAt.set(e.at, k + 1);
        const dim = !f ? 1 : f.keys.includes(e.from) && f.keys.includes(e.to) ? 1 : 0.32;
        return (
          <Edge key={i} a={boxes.get(e.from)!} b={boxes.get(e.to)!} {...e} t={e.tone} dim={dim} stagger={k * 12} />
        );
      })}
      {s.nodes.map((n) => (
        <NodeCard
          key={n.key}
          label={n.label}
          sub={n.sub}
          icon={n.icon}
          t={n.tone}
          box={boxes.get(n.key)!}
          at={n.at}
          mono={n.mono}
          focus={focusOf(n.key)}
        />
      ))}
    </>
  );
};

const GroupBox: React.FC<{ label: string; x: number; y: number; w: number; h: number; tone: Tone; at: number }> = ({
  label,
  x,
  y,
  w,
  h,
  tone: t,
  at,
}) => {
  const { SANS, TONES } = usePalette();
  const p = useAppear(at);
  const tt = TONES[t];
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 30,
        border: `2px dashed ${alpha(tt.main, 0x66 / 255)}`,
        background: tt.soft,
        opacity: p * 0.9,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 22,
          top: 14,
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: TYPE.label.group,
          color: tt.text,
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const flow = defineScene({ kind: 'flow', Component: Flow });
