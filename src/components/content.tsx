import React from 'react';
import { CONTENT_BOTTOM, CONTENT_TOP, PAD } from '../theme';

/** 内容の枠（見出しの下から、下の出典・注意書きの上まで）。中身を縦に並べ、上下の真ん中に置く */
export const Content: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: 'absolute',
      left: PAD,
      right: PAD,
      top: CONTENT_TOP,
      bottom: 1080 - CONTENT_BOTTOM,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      ...style,
    }}
  >
    {children}
  </div>
);
