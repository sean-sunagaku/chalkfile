// 講座どうしのリンク。公開先を台本に書かず、サイトに出す URL へ直す。
import { ORIGIN } from '../../engine/core/project-settings';
import type { Course } from '../types';

type Link = { label: string; course: string } | { label: string; url: string };
export const courseLinks = (links: readonly Link[]): NonNullable<Course['links']> => links.map((link) => {
  if (!('course' in link)) return link;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(link.course)) throw new Error(`講座のリンクの ID が読めない: ${link.course}`);
  return { label: link.label, url: new URL(`${link.course}/`, ORIGIN).href };
});
