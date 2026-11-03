// Remotion の入口。動画のエンジン（src/Root.tsx の Root）に、中身（content/）とのつなぎ（src/project.ts の PROJECT）を渡す。
// 中身とエンジンをつなぐのは、ここと src/project.ts だけ
import React from 'react';
import { registerRoot } from 'remotion';
import { PROJECT } from './project';
import { Root } from './Root';

/** この講座集の動画（Root に、描くものの一式を渡す） */
const ProjectRoot: React.FC = () => React.createElement(Root, { project: PROJECT });

registerRoot(ProjectRoot);
