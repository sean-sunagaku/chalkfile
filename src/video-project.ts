// 動画のエンジン（src/Root.tsx の Root・src/Lecture.tsx の LectureVideo）が受け取る、描くものの一式。
// 作るのは中身（content/）とのつなぎの src/project.ts だけで、src/index.ts が Root の props に渡す。Root は context で下に配り、
// 動画 1 本の部品（LectureVideo）は useProject() で読む（Remotion は、コンポジションの部品を <Composition> の場所から portal で描くので、
// Root の context が届く）。場面と部品は content/ を読まず、描くものを props（場面の s）と context（SceneProvider・ThemeProvider）で受け取る
import React, { createContext, useContext } from 'react';
import type { Theme, Video } from '../engine/core/schema';
import type { TimelineEntry } from '../engine/core/timeline';

export type VideoProject = {
  /** 動画の一覧（日本語の全講座と訳。key は S01・S01.en） */
  videos: readonly Video[];
  /** 動画の名前 → 動画（無い名前は、どの講座に無いのかを書いて止める） */
  videoOf: (key: string) => Video;
  /** テーマの id → テーマ（書かなければ既定のテーマ。無い id は止める） */
  themeOf: (id?: string) => Theme;
  /** 動画の名前 → 置いてある timeline のファイル（読めなかったものも error を入れて持つ。描く前に Root が台本と照らし合わせる） */
  timelines: ReadonlyMap<string, TimelineEntry[]>;
};

const ProjectContext = createContext<VideoProject | null>(null);

/** 子の部品に、描くものの一式を渡す（src/Root.tsx が、コンポジションの一覧を包む） */
export const ProjectProvider: React.FC<{ project: VideoProject; children: React.ReactNode }> = ({
  project,
  children,
}) => React.createElement(ProjectContext.Provider, { value: project }, children);

/** 描くものの一式（ProjectProvider の中だけで読める） */
export const useProject = (): VideoProject => {
  const p = useContext(ProjectContext);
  if (!p)
    throw new Error('ProjectProvider の外で useProject が使われた（src/Root.tsx の Root が ProjectProvider で包む）');
  return p;
};
