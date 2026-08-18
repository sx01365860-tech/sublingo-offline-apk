import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SubtitleProject } from "@/lib/subtitles";

const PROJECTS_KEY = "sublingo-offline.projects.v1";

export async function loadProjects(): Promise<SubtitleProject[]> {
  const raw = await AsyncStorage.getItem(PROJECTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SubtitleProject[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  } catch {
    return [];
  }
}

export async function saveProjects(projects: SubtitleProject[]) {
  await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export async function removeProject(projectId: string) {
  const projects = await loadProjects();
  const next = projects.filter((project) => project.id !== projectId);
  await saveProjects(next);
  return next;
}
