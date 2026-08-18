import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { VideoView, useVideoPlayer } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import TextRecognition, { TextRecognitionScript } from "@react-native-ml-kit/text-recognition";
import TranslateText, { TranslateLanguage } from "@react-native-ml-kit/translate-text";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { loadProjects, removeProject, saveProjects } from "@/lib/project-store";
import {
  buildSrt,
  createId,
  formatClock,
  makeCue,
  type SubtitleCue,
  type SubtitleProject,
  upsertCue,
} from "@/lib/subtitles";

type Screen = "home" | "setup" | "process" | "editor" | "export";
type CropPreset = SubtitleProject["cropPreset"];

const COLORS = {
  ink: "#0B1020",
  slate: "#182238",
  paper: "#F3F7FC",
  muted: "#9AA8BE",
  line: "#2A3752",
  amber: "#F6B84B",
  cyan: "#37C6D0",
  mint: "#55D6A0",
  coral: "#FF7A6B",
};

const initialScanTime = 1000;

function ActionButton({ label, icon, onPress, secondary = false, disabled = false }: { label: string; icon: keyof typeof MaterialIcons.glyphMap; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, secondary ? styles.secondaryButton : styles.primaryButton, (pressed || disabled) && styles.pressed, disabled && styles.disabled]}
    >
      <MaterialIcons color={secondary ? COLORS.paper : COLORS.ink} name={icon} size={20} />
      <Text style={[styles.actionButtonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "ready" | "warning" }) {
  const color = tone === "ready" ? COLORS.mint : tone === "warning" ? COLORS.amber : COLORS.cyan;
  return (
    <View style={[styles.statusChip, { borderColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusChipText, { color }]}>{label}</Text>
    </View>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <MaterialIcons color={COLORS.paper} name="arrow-back" size={24} />
        </Pressable>
      ) : (
        <View style={styles.brandMark}><MaterialIcons color={COLORS.ink} name="closed-caption" size={20} /></View>
      )}
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [screen, setScreen] = useState<Screen>("home");
  const [projects, setProjects] = useState<SubtitleProject[]>([]);
  const [project, setProject] = useState<SubtitleProject | null>(null);
  const [previewUri, setPreviewUri] = useState<string | undefined>();
  const [scanTimeMs, setScanTimeMs] = useState(initialScanTime);
  const [isBusy, setIsBusy] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [offlineMode, setOfflineMode] = useState(true);
  const [editingCue, setEditingCue] = useState<SubtitleCue | null>(null);

  const player = useVideoPlayer(project?.videoUri ?? null, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  const persistProject = useCallback(async (next: SubtitleProject) => {
    const withTimestamp = { ...next, updatedAt: new Date().toISOString() };
    setProject(withTimestamp);
    setProjects((previous) => {
      const merged = [withTimestamp, ...previous.filter((item) => item.id !== withTimestamp.id)];
      void saveProjects(merged);
      return merged;
    });
    return withTimestamp;
  }, []);

  useEffect(() => {
    void loadProjects().then(setProjects);
  }, []);

  const createPreview = useCallback(async (uri: string, time: number) => {
    const result = await VideoThumbnails.getThumbnailAsync(uri, { time, quality: 0.92 });
    setPreviewUri(result.uri);
    return result.uri;
  }, []);

  const pickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "video/*", copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const next: SubtitleProject = {
        id: createId("project"),
        sourceName: asset.name,
        videoUri: asset.uri,
        size: asset.size,
        cropPreset: "bottom-center",
        status: "draft",
        cues: [],
        updatedAt: new Date().toISOString(),
      };
      setProject(next);
      setPreviewUri(undefined);
      setScanTimeMs(initialScanTime);
      setScreen("setup");
      setIsBusy(true);
      setProgressText("Đang tạo ảnh xem trước từ video…");
      try {
        const imageUri = await createPreview(asset.uri, initialScanTime);
        setProject((current) => current ? { ...current, thumbnailUri: imageUri } : current);
      } finally {
        setIsBusy(false);
        setProgressText("");
      }
    } catch (error) {
      Alert.alert("Không thể mở video", error instanceof Error ? error.message : "Hãy thử chọn một tệp video khác.");
    }
  };

  const setCropPreset = (cropPreset: CropPreset) => {
    if (!project) return;
    setProject({ ...project, cropPreset });
  };

  const refreshPreview = async (time = scanTimeMs) => {
    if (!project) return;
    try {
      setIsBusy(true);
      setProgressText("Đang lấy ảnh frame ở thời điểm đã chọn…");
      const frameUri = await createPreview(project.videoUri, time);
      setProject((current) => current ? { ...current, thumbnailUri: frameUri } : current);
    } catch (error) {
      Alert.alert("Không thể tạo frame", error instanceof Error ? error.message : "Frame này không đọc được. Hãy thử thời điểm khác.");
    } finally {
      setIsBusy(false);
      setProgressText("");
    }
  };

  const runOcr = async () => {
    if (!project || !previewUri) {
      Alert.alert("Chưa có ảnh frame", "Hãy chờ ảnh xem trước được tạo hoặc chạm Làm mới frame.");
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert("Cần APK native", "Nhận diện ML Kit chỉ chạy sau khi bạn cài APK native; bản xem trước web chỉ dùng để kiểm tra giao diện.");
      return;
    }
    setScreen("process");
    setIsBusy(true);
    try {
      setProgressValue(12);
      setProgressText("Đang kiểm tra ảnh frame và vùng phụ đề…");
      await new Promise((resolve) => setTimeout(resolve, 250));
      setProgressValue(42);
      setProgressText("ML Kit đang nhận diện chữ Trung Quốc trên thiết bị…");
      const result = await TextRecognition.recognize(previewUri, TextRecognitionScript.CHINESE);
      const text = result.blocks.flatMap((block) => block.lines.map((line) => line.text)).join(" ").trim();
      setProgressValue(78);
      setProgressText("Đang tạo cue SRT để bạn kiểm tra…");
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (!text) {
        Alert.alert("Chưa đọc được phụ đề", "Hãy chọn frame có phụ đề rõ hơn, đổi preset vùng phụ đề, hoặc kiểm tra video có chữ Trung hiển thị rõ.");
        setScreen("setup");
        return;
      }
      const cue = makeCue(text, scanTimeMs, result.blocks.length > 0 ? "medium" : "low");
      const next = await persistProject({ ...project, status: "review", cues: upsertCue(project.cues, cue), thumbnailUri: previewUri });
      setProject(next);
      setProgressValue(100);
      setProgressText("Đã tạo cue. Bạn có thể sửa ngay trong trình biên tập.");
      await new Promise((resolve) => setTimeout(resolve, 350));
      setScreen("editor");
    } catch (error) {
      Alert.alert("OCR chưa chạy được", error instanceof Error ? error.message : "Hãy cài APK native, sau đó thử lại với frame khác.");
      setScreen("setup");
    } finally {
      setIsBusy(false);
    }
  };

  const translateCues = async () => {
    if (!project) return;
    const targets = project.cues.filter((cue) => cue.sourceText.trim());
    if (!targets.length) {
      Alert.alert("Chưa có câu để dịch", "Hãy tạo ít nhất một cue OCR hoặc nhập câu tiếng Trung trong trình biên tập.");
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert("Cần APK native", "Dịch ML Kit trên thiết bị chỉ chạy trong APK. Bản xem trước web không tải model ngôn ngữ.");
      return;
    }
    setScreen("process");
    setIsBusy(true);
    try {
      let nextCues = [...project.cues];
      for (let index = 0; index < targets.length; index += 1) {
        const cue = targets[index];
        setProgressValue(Math.round((index / targets.length) * 90) + 5);
        setProgressText(index === 0 ? "Đang tải model Trung–Việt lần đầu (nếu máy chưa có)…" : `Đang dịch câu ${index + 1}/${targets.length} trên thiết bị…`);
        const raw = await TranslateText.translate({
          text: cue.sourceText,
          sourceLanguage: TranslateLanguage.CHINESE,
          targetLanguage: TranslateLanguage.VIETNAMESE,
          downloadModelIfNeeded: true,
          requireWifi: false,
        });
        const translatedText = raw as unknown as string;
        nextCues = nextCues.map((item) => item.id === cue.id ? { ...item, translatedText } : item);
      }
      const next = await persistProject({ ...project, status: "review", cues: nextCues });
      setProject(next);
      setProgressValue(100);
      setProgressText("Đã dịch xong. Hãy rà soát các tên riêng và ngữ cảnh trước khi xuất.");
      await new Promise((resolve) => setTimeout(resolve, 350));
      setScreen("editor");
    } catch (error) {
      Alert.alert("Dịch chưa hoàn tất", error instanceof Error ? error.message : "Hãy kết nối mạng một lần để tải model Trung–Việt, rồi thử lại.");
      setScreen("editor");
    } finally {
      setIsBusy(false);
    }
  };

  const updateCue = async (nextCue: SubtitleCue) => {
    if (!project) return;
    const next = await persistProject({ ...project, cues: project.cues.map((cue) => cue.id === nextCue.id ? nextCue : cue), status: "review" });
    setProject(next);
    setEditingCue(null);
  };

  const deleteCue = (cue: SubtitleCue) => {
    Alert.alert("Xóa cue?", "Thao tác này chỉ xóa câu khỏi dự án cục bộ.", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => { if (project) void persistProject({ ...project, cues: project.cues.filter((item) => item.id !== cue.id) }); } },
    ]);
  };

  const addManualCue = async () => {
    if (!project) return;
    const cue = makeCue("", scanTimeMs, "low");
    const next = await persistProject({ ...project, status: "review", cues: [...project.cues, cue] });
    setProject(next);
    setEditingCue(cue);
  };

  const exportSrt = async (mode: "vi" | "bilingual") => {
    if (!project) return;
    if (!project.cues.length) {
      Alert.alert("Chưa có phụ đề", "Hãy tạo hoặc nhập ít nhất một cue trước khi xuất SRT.");
      return;
    }
    try {
      const directory = FileSystem.documentDirectory;
      if (!directory) throw new Error("Không tìm thấy thư mục dữ liệu cục bộ.");
      const base = project.sourceName.replace(/\.[^/.]+$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 44) || "sublingo";
      const fileUri = `${directory}${base}_${mode === "vi" ? "vi" : "zh-vi"}.srt`;
      await FileSystem.writeAsStringAsync(fileUri, buildSrt(project.cues, mode), { encoding: FileSystem.EncodingType.UTF8 });
      const next = await persistProject({ ...project, status: "exported" });
      setProject(next);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: "application/x-subrip", dialogTitle: "Xuất phụ đề SRT" });
      } else {
        Alert.alert("Đã tạo SRT", `Tệp đã được lưu trong dữ liệu ứng dụng: ${fileUri}`);
      }
    } catch (error) {
      Alert.alert("Không thể xuất SRT", error instanceof Error ? error.message : "Hãy thử lại.");
    }
  };

  const deleteProject = (item: SubtitleProject) => {
    Alert.alert("Xóa dự án?", `Dự án “${item.sourceName}” và các cue đã lưu sẽ bị xóa khỏi app. Video gốc trên máy không bị xóa.`, [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => { void removeProject(item.id).then(setProjects); if (project?.id === item.id) { setProject(null); setScreen("home"); } } },
    ]);
  };

  const projectStatus = useMemo(() => project?.cues.length ? `${project.cues.length} cue` : "Chưa có cue", [project?.cues.length]);

  if (screen === "home") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background">
        <View style={styles.app}>
          <Header title="SubLingo Offline" subtitle="Trích phụ đề Trung → Việt, ưu tiên dữ liệu cục bộ" />
          <ScrollView contentContainerStyle={styles.homeScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.heroCard}>
              <View style={styles.heroAccent}><MaterialIcons color={COLORS.amber} name="subtitles" size={36} /></View>
              <Text style={styles.heroTitle}>Tạo SRT từ video trong máy</Text>
              <Text style={styles.heroBody}>Video được chọn và phụ đề của bạn ở lại trên thiết bị. Bản thử nghiệm quét frame phụ đề và cho phép rà soát trước khi xuất.</Text>
              <View style={styles.privacyRow}>
                <MaterialIcons color={COLORS.mint} name="lock" size={16} />
                <Text style={styles.privacyText}>Không cần tài khoản. Không tải video gốc lên máy chủ.</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Dự án gần đây</Text>
            {projects.length ? (
              <FlatList
                data={projects}
                scrollEnabled={false}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.projectList}
                renderItem={({ item }) => (
                  <Pressable onPress={() => { setProject(item); setPreviewUri(item.thumbnailUri); setScreen("editor"); }} style={({ pressed }) => [styles.projectCard, pressed && styles.pressed]}>
                    <View style={styles.projectIcon}><MaterialIcons color={COLORS.cyan} name="movie" size={24} /></View>
                    <View style={styles.projectCopy}>
                      <Text numberOfLines={1} style={styles.projectName}>{item.sourceName}</Text>
                      <Text style={styles.projectMeta}>{item.cues.length} cue · {item.status === "exported" ? "Đã xuất" : "Đang soạn"}</Text>
                    </View>
                    <Pressable accessibilityLabel={`Xóa ${item.sourceName}`} hitSlop={10} onPress={() => deleteProject(item)} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                      <MaterialIcons color={COLORS.muted} name="more-vert" size={21} />
                    </Pressable>
                  </Pressable>
                )}
              />
            ) : (
              <View style={styles.emptyCard}>
                <MaterialIcons color={COLORS.muted} name="video-library" size={28} />
                <Text style={styles.emptyTitle}>Chưa có dự án</Text>
                <Text style={styles.emptyBody}>Chọn một video có phụ đề cứng tiếng Trung để bắt đầu.</Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.bottomAction}><ActionButton icon="add" label="Tạo dự án từ video" onPress={pickVideo} /></View>
        </View>
      </ScreenContainer>
    );
  }

  if (screen === "setup" && project) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.app}>
          <Header title="Thiết lập OCR" subtitle={project.sourceName} onBack={() => setScreen("home")} />
          <ScrollView contentContainerStyle={styles.screenScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.videoPanel}>
              <VideoView allowsFullscreen contentFit="contain" nativeControls player={player} style={styles.video} surfaceType="textureView" />
              <View pointerEvents="none" style={[styles.cropGuide, project.cropPreset === "bottom-wide" && styles.cropGuideWide, project.cropPreset === "custom" && styles.cropGuideCustom]}>
                <Text style={styles.cropLabel}>VÙNG PHỤ ĐỀ</Text>
              </View>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Vùng phụ đề</Text>
              <StatusChip label="Tiếng Trung" />
            </View>
            <View style={styles.presetRow}>
              {(["bottom-center", "bottom-wide", "custom"] as CropPreset[]).map((preset) => (
                <Pressable key={preset} onPress={() => setCropPreset(preset)} style={({ pressed }) => [styles.preset, project.cropPreset === preset && styles.presetSelected, pressed && styles.pressed]}>
                  <Text style={[styles.presetText, project.cropPreset === preset && styles.presetTextSelected]}>{preset === "bottom-center" ? "Đáy giữa" : preset === "bottom-wide" ? "Đáy rộng" : "Tự chỉnh"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.frameCard}>
              <View style={styles.rowBetween}>
                <View><Text style={styles.frameTitle}>Frame để quét thử</Text><Text style={styles.frameHint}>Chọn đúng thời điểm chữ Trung xuất hiện rõ.</Text></View>
                <Text style={styles.timeValue}>{formatClock(scanTimeMs)}</Text>
              </View>
              <View style={styles.timeStepper}>
                <Pressable accessibilityLabel="Giảm 1 giây" onPress={() => setScanTimeMs((time) => Math.max(0, time - 1000))} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}><MaterialIcons color={COLORS.paper} name="remove" size={19} /></Pressable>
                <Pressable onPress={() => void refreshPreview()} style={({ pressed }) => [styles.framePreview, pressed && styles.pressed]}>
                  {previewUri ? <Image source={{ uri: previewUri }} style={styles.previewImage} /> : <ActivityIndicator color={COLORS.amber} />}
                  <View style={styles.previewOverlay}><MaterialIcons color={COLORS.paper} name="refresh" size={17} /><Text style={styles.previewOverlayText}>Làm mới frame</Text></View>
                </Pressable>
                <Pressable accessibilityLabel="Tăng 1 giây" onPress={() => setScanTimeMs((time) => time + 1000)} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}><MaterialIcons color={COLORS.paper} name="add" size={19} /></Pressable>
              </View>
            </View>
            <View style={styles.notice}><MaterialIcons color={COLORS.amber} name="info-outline" size={18} /><Text style={styles.noticeText}>Bản thử nghiệm quét một frame để kiểm tra OCR Chinese và luồng sửa SRT. Quét hàng loạt toàn video sẽ được thêm sau khi bạn thử.</Text></View>
          </ScrollView>
          <View style={styles.bottomAction}><ActionButton disabled={isBusy || !previewUri} icon="document-scanner" label={isBusy ? "Đang tạo frame…" : "Quét phụ đề trên frame"} onPress={() => void runOcr()} /></View>
        </View>
      </ScreenContainer>
    );
  }

  if (screen === "process") {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={[styles.app, styles.processScreen]}>
          <View style={styles.processIcon}><MaterialIcons color={COLORS.amber} name="auto-awesome" size={42} /></View>
          <Text style={styles.processTitle}>Đang xử lý trên thiết bị</Text>
          <Text style={styles.processBody}>{progressText}</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressValue}%` }]} /></View>
          <Text style={styles.progressNumber}>{progressValue}%</Text>
          <Text style={styles.processPrivacy}>Không tải video gốc lên mạng. Nếu model dịch chưa có trên máy, app chỉ tải model ngôn ngữ khi bạn yêu cầu dịch.</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (screen === "export" && project) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.app}>
          <Header title="Xuất phụ đề" subtitle={`${project.cues.length} cue sẵn sàng`} onBack={() => setScreen("editor")} />
          <ScrollView contentContainerStyle={styles.screenScroll}>
            <View style={styles.exportHero}><MaterialIcons color={COLORS.mint} name="file-download" size={44} /><Text style={styles.exportHeroTitle}>Xuất SRT chuẩn UTF-8</Text><Text style={styles.exportHeroBody}>Dùng bảng chia sẻ Android để lưu vào thư mục bạn chọn, gửi Telegram hoặc mở bằng trình biên tập phụ đề.</Text></View>
            <View style={styles.exportOption}><View style={styles.exportOptionIcon}><MaterialIcons color={COLORS.amber} name="translate" size={23} /></View><View style={styles.exportCopy}><Text style={styles.exportTitle}>SRT tiếng Việt</Text><Text style={styles.exportBody}>Ưu tiên dùng bản dịch. Cue chưa dịch sẽ giữ tiếng Trung để tránh mất nội dung.</Text></View><ActionButton icon="file-download" label="Xuất" onPress={() => void exportSrt("vi")} /></View>
            <View style={styles.exportOption}><View style={styles.exportOptionIcon}><MaterialIcons color={COLORS.cyan} name="subtitles" size={23} /></View><View style={styles.exportCopy}><Text style={styles.exportTitle}>SRT song ngữ</Text><Text style={styles.exportBody}>Mỗi cue gồm tiếng Trung gốc và tiếng Việt để đối chiếu.</Text></View><ActionButton icon="file-download" label="Xuất" secondary onPress={() => void exportSrt("bilingual")} /></View>
          </ScrollView>
        </View>
      </ScreenContainer>
    );
  }

  if (screen === "editor" && project) {
    return (
      <ScreenContainer edges={["top", "left", "right", "bottom"]}>
        <View style={styles.app}>
          <Header title="Rà soát phụ đề" subtitle={`${project.sourceName} · ${projectStatus}`} onBack={() => setScreen("home")} />
          <View style={styles.editorToolbar}>
            <StatusChip label={offlineMode ? "Ưu tiên offline" : "AI online (sắp có)"} tone={offlineMode ? "ready" : "warning"} />
            <View style={styles.modeSwitch}><Text style={styles.switchText}>Chế độ offline</Text><Switch accessibilityLabel="Chế độ offline đang được ưu tiên trong bản thử nghiệm" trackColor={{ false: COLORS.line, true: "#287266" }} thumbColor={offlineMode ? COLORS.mint : COLORS.paper} value={offlineMode} onValueChange={(next) => { if (next) { setOfflineMode(true); return; } Alert.alert("AI online chưa cấu hình", "Bản chạy thử giữ chế độ offline để kiểm tra OCR, dịch ML Kit và xuất SRT. Nút AI online sẽ được thêm sau khi bạn phản hồi về bản này."); }} /></View>
          </View>
          {project.thumbnailUri ? <View style={styles.editorVideoStrip}><Image source={{ uri: project.thumbnailUri }} style={styles.editorThumbnail} /><View style={styles.editorVideoCopy}><Text style={styles.editorVideoTitle}>Frame gần nhất</Text><Text style={styles.editorVideoMeta}>OCR chạy trên ảnh frame cục bộ</Text></View><Pressable onPress={() => { setPreviewUri(project.thumbnailUri); setScreen("setup"); }} style={({ pressed }) => [styles.smallOutlineButton, pressed && styles.pressed]}><Text style={styles.smallOutlineText}>Quét thêm</Text></Pressable></View> : null}
          {project.cues.length ? (
            <FlatList
              data={project.cues}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.cueList}
              renderItem={({ item, index }) => (
                <Pressable onPress={() => setEditingCue(item)} style={({ pressed }) => [styles.cueCard, pressed && styles.pressed]}>
                  <View style={styles.cueHeader}><Text style={styles.cueIndex}>{String(index + 1).padStart(2, "0")}</Text><Text style={styles.cueTime}>{formatClock(item.startMs)} — {formatClock(item.endMs)}</Text><View style={[styles.confidencePill, item.confidence === "low" && styles.confidenceLow]}><Text style={styles.confidenceText}>{item.confidence === "high" ? "Tốt" : item.confidence === "medium" ? "Cần xem" : "Thấp"}</Text></View></View>
                  <Text style={styles.sourceCue}>{item.sourceText || "Chạm để nhập tiếng Trung"}</Text>
                  <Text style={[styles.translationCue, !item.translatedText && styles.placeholderCue]}>{item.translatedText || "Chạm để thêm bản dịch tiếng Việt"}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<View style={styles.emptyCard}><MaterialIcons color={COLORS.muted} name="subtitles-off" size={30} /><Text style={styles.emptyTitle}>Chưa có cue</Text><Text style={styles.emptyBody}>Quay lại thiết lập để quét một frame hoặc tạo cue thủ công để kiểm tra chỉnh sửa và xuất SRT.</Text><View style={styles.inlineButton}><ActionButton icon="document-scanner" label="Quét một frame" secondary onPress={() => setScreen("setup")} /></View><View style={styles.inlineButton}><ActionButton icon="edit" label="Tạo cue thủ công" secondary onPress={() => void addManualCue()} /></View></View>}
            />
          ) : null}
          <View style={styles.editorFooter}><ActionButton icon="translate" label="Dịch Trung → Việt" secondary disabled={isBusy || !project.cues.length} onPress={() => void translateCues()} /><ActionButton icon="file-download" label="Xuất SRT" disabled={!project.cues.length} onPress={() => setScreen("export")} /></View>
        </View>
        <CueModal cue={editingCue} onClose={() => setEditingCue(null)} onDelete={deleteCue} onSave={updateCue} />
      </ScreenContainer>
    );
  }

  return null;
}

function CueModal({ cue, onClose, onSave, onDelete }: { cue: SubtitleCue | null; onClose: () => void; onSave: (cue: SubtitleCue) => Promise<void>; onDelete: (cue: SubtitleCue) => void }) {
  const [draft, setDraft] = useState<SubtitleCue | null>(cue);
  useEffect(() => setDraft(cue), [cue]);
  if (!draft) return null;
  const changeTime = (key: "startMs" | "endMs", delta: number) => setDraft((current) => current ? { ...current, [key]: Math.max(0, current[key] + delta) } : current);
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={Boolean(cue)}>
      <SafeAreaView style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Sửa cue</Text><Text style={styles.modalSubtitle}>Điều chỉnh chữ và thời gian trước khi xuất.</Text></View><Pressable accessibilityLabel="Đóng" onPress={onClose} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}><MaterialIcons color={COLORS.paper} name="close" size={24} /></Pressable></View>
          <Text style={styles.inputLabel}>Tiếng Trung gốc</Text><TextInput multiline onChangeText={(sourceText) => setDraft((current) => current ? { ...current, sourceText } : current)} placeholder="Nhập tiếng Trung" placeholderTextColor={COLORS.muted} style={styles.textArea} value={draft.sourceText} />
          <Text style={styles.inputLabel}>Bản dịch tiếng Việt</Text><TextInput multiline onChangeText={(translatedText) => setDraft((current) => current ? { ...current, translatedText } : current)} placeholder="Nhập bản dịch" placeholderTextColor={COLORS.muted} style={styles.textArea} value={draft.translatedText} />
          <View style={styles.timeEditRow}><TimeEditor label="Bắt đầu" value={draft.startMs} onMinus={() => changeTime("startMs", -100)} onPlus={() => changeTime("startMs", 100)} /><TimeEditor label="Kết thúc" value={draft.endMs} onMinus={() => changeTime("endMs", -100)} onPlus={() => changeTime("endMs", 100)} /></View>
          <View style={styles.modalActions}><Pressable onPress={() => onDelete(draft)} style={({ pressed }) => [styles.deleteTextButton, pressed && styles.pressed]}><MaterialIcons color={COLORS.coral} name="delete-outline" size={20} /><Text style={styles.deleteText}>Xóa cue</Text></Pressable><View style={styles.modalSave}><ActionButton icon="check" label="Lưu cue" onPress={() => { if (draft.endMs <= draft.startMs) { Alert.alert("Kiểm tra thời gian", "Thời điểm kết thúc phải lớn hơn thời điểm bắt đầu."); return; } void onSave(draft); }} /></View></View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function TimeEditor({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return <View style={styles.timeEditor}><Text style={styles.inputLabel}>{label}</Text><View style={styles.timeEditorControls}><Pressable onPress={onMinus} style={({ pressed }) => [styles.timeSmallButton, pressed && styles.pressed]}><MaterialIcons color={COLORS.paper} name="remove" size={16} /></Pressable><Text style={styles.timeEditValue}>{formatClock(value)}</Text><Pressable onPress={onPlus} style={({ pressed }) => [styles.timeSmallButton, pressed && styles.pressed]}><MaterialIcons color={COLORS.paper} name="add" size={16} /></Pressable></View></View>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: COLORS.ink },
  header: { alignItems: "center", flexDirection: "row", gap: 12, minHeight: 64, paddingHorizontal: 20, paddingTop: 8 },
  brandMark: { alignItems: "center", backgroundColor: COLORS.amber, borderRadius: 12, height: 40, justifyContent: "center", width: 40 },
  headerText: { flex: 1 }, headerTitle: { color: COLORS.paper, fontSize: 19, fontWeight: "800" }, headerSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 2 },
  iconButton: { alignItems: "center", borderRadius: 22, height: 42, justifyContent: "center", width: 42 },
  homeScroll: { gap: 18, padding: 20, paddingBottom: 112 }, screenScroll: { gap: 18, padding: 20, paddingBottom: 108 },
  heroCard: { backgroundColor: COLORS.slate, borderColor: "#283755", borderRadius: 24, borderWidth: 1, gap: 12, padding: 22 }, heroAccent: { alignItems: "center", backgroundColor: "#2B2631", borderRadius: 14, height: 58, justifyContent: "center", width: 58 },
  heroTitle: { color: COLORS.paper, fontSize: 25, fontWeight: "800", letterSpacing: -0.4 }, heroBody: { color: "#C1CDE0", fontSize: 15, lineHeight: 22 }, privacyRow: { alignItems: "center", flexDirection: "row", gap: 8, marginTop: 2 }, privacyText: { color: COLORS.mint, flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  sectionTitle: { color: COLORS.paper, fontSize: 16, fontWeight: "800", marginTop: 5 }, projectList: { gap: 10 }, projectCard: { alignItems: "center", backgroundColor: COLORS.slate, borderColor: COLORS.line, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 12, minHeight: 76, padding: 12 }, projectIcon: { alignItems: "center", backgroundColor: "#122D3A", borderRadius: 12, height: 48, justifyContent: "center", width: 48 }, projectCopy: { flex: 1, gap: 4 }, projectName: { color: COLORS.paper, fontSize: 14, fontWeight: "700" }, projectMeta: { color: COLORS.muted, fontSize: 12 }, deleteButton: { alignItems: "center", height: 38, justifyContent: "center", width: 30 },
  emptyCard: { alignItems: "center", backgroundColor: "#111A2B", borderColor: COLORS.line, borderRadius: 18, borderStyle: "dashed", borderWidth: 1, gap: 8, padding: 28 }, emptyTitle: { color: COLORS.paper, fontSize: 15, fontWeight: "800" }, emptyBody: { color: COLORS.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  bottomAction: { backgroundColor: COLORS.ink, borderTopColor: "#1E2940", borderTopWidth: 1, padding: 14, paddingBottom: 16 }, actionButton: { alignItems: "center", borderRadius: 15, flexDirection: "row", gap: 9, justifyContent: "center", minHeight: 52, paddingHorizontal: 16 }, primaryButton: { backgroundColor: COLORS.amber }, secondaryButton: { backgroundColor: "#243655", borderColor: "#39517B", borderWidth: 1 }, actionButtonText: { color: COLORS.ink, fontSize: 14, fontWeight: "800" }, secondaryButtonText: { color: COLORS.paper }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] }, disabled: { opacity: 0.42 },
  videoPanel: { aspectRatio: 16 / 9, backgroundColor: "#050815", borderColor: COLORS.line, borderRadius: 18, borderWidth: 1, overflow: "hidden", position: "relative" }, video: { height: "100%", width: "100%" }, cropGuide: { borderColor: COLORS.amber, borderRadius: 7, borderWidth: 2, bottom: "8%", height: "18%", left: "20%", position: "absolute", right: "20%" }, cropGuideWide: { left: "6%", right: "6%" }, cropGuideCustom: { bottom: "15%", height: "26%", left: "14%", right: "14%" }, cropLabel: { backgroundColor: COLORS.amber, color: COLORS.ink, fontSize: 9, fontWeight: "900", left: 0, paddingHorizontal: 5, paddingVertical: 2, position: "absolute", top: -21 },
  rowBetween: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, label: { color: COLORS.paper, fontSize: 16, fontWeight: "800" }, statusChip: { alignItems: "center", borderRadius: 99, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 9, paddingVertical: 5 }, statusDot: { borderRadius: 4, height: 7, width: 7 }, statusChipText: { fontSize: 11, fontWeight: "800" },
  presetRow: { flexDirection: "row", gap: 8 }, preset: { alignItems: "center", backgroundColor: "#111A2B", borderColor: COLORS.line, borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: 7 }, presetSelected: { backgroundColor: "#3D311B", borderColor: COLORS.amber }, presetText: { color: COLORS.muted, fontSize: 12, fontWeight: "700" }, presetTextSelected: { color: COLORS.amber },
  frameCard: { backgroundColor: COLORS.slate, borderColor: COLORS.line, borderRadius: 18, borderWidth: 1, gap: 14, padding: 16 }, frameTitle: { color: COLORS.paper, fontSize: 14, fontWeight: "800" }, frameHint: { color: COLORS.muted, fontSize: 12, marginTop: 3 }, timeValue: { color: COLORS.amber, fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "800" }, timeStepper: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "center" }, stepButton: { alignItems: "center", backgroundColor: "#101B30", borderColor: COLORS.line, borderRadius: 14, borderWidth: 1, height: 50, justifyContent: "center", width: 48 }, framePreview: { backgroundColor: "#060B15", borderRadius: 12, flex: 1, height: 112, overflow: "hidden", position: "relative" }, previewImage: { height: "100%", width: "100%" }, previewOverlay: { alignItems: "center", backgroundColor: "rgba(4,8,17,0.76)", bottom: 0, flexDirection: "row", gap: 5, justifyContent: "center", paddingVertical: 7, position: "absolute", width: "100%" }, previewOverlayText: { color: COLORS.paper, fontSize: 11, fontWeight: "800" }, notice: { alignItems: "flex-start", backgroundColor: "#292516", borderColor: "#66511F", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 9, padding: 13 }, noticeText: { color: "#E7D6A2", flex: 1, fontSize: 12, lineHeight: 18 },
  processScreen: { alignItems: "center", justifyContent: "center", padding: 28 }, processIcon: { alignItems: "center", backgroundColor: "#2C2633", borderRadius: 50, height: 92, justifyContent: "center", marginBottom: 20, width: 92 }, processTitle: { color: COLORS.paper, fontSize: 24, fontWeight: "800" }, processBody: { color: "#C0CDDF", fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 330, textAlign: "center" }, progressTrack: { backgroundColor: COLORS.line, borderRadius: 9, height: 9, marginTop: 28, overflow: "hidden", width: "100%" }, progressFill: { backgroundColor: COLORS.amber, borderRadius: 9, height: "100%" }, progressNumber: { color: COLORS.amber, fontSize: 14, fontVariant: ["tabular-nums"], fontWeight: "800", marginTop: 9 }, processPrivacy: { color: COLORS.muted, fontSize: 12, lineHeight: 18, marginTop: 28, textAlign: "center" },
  editorToolbar: { alignItems: "center", borderBottomColor: "#1E2940", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 11 }, modeSwitch: { alignItems: "center", flexDirection: "row", gap: 6 }, switchText: { color: COLORS.muted, fontSize: 11, fontWeight: "700" }, editorVideoStrip: { alignItems: "center", backgroundColor: "#111A2B", borderBottomColor: "#1E2940", borderBottomWidth: 1, flexDirection: "row", gap: 10, padding: 10 }, editorThumbnail: { borderRadius: 7, height: 48, width: 76 }, editorVideoCopy: { flex: 1 }, editorVideoTitle: { color: COLORS.paper, fontSize: 12, fontWeight: "800" }, editorVideoMeta: { color: COLORS.muted, fontSize: 11, marginTop: 3 }, smallOutlineButton: { borderColor: COLORS.cyan, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 }, smallOutlineText: { color: COLORS.cyan, fontSize: 11, fontWeight: "800" }, cueList: { gap: 10, padding: 14, paddingBottom: 94 }, cueCard: { backgroundColor: COLORS.slate, borderColor: COLORS.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 14 }, cueHeader: { alignItems: "center", flexDirection: "row", gap: 9 }, cueIndex: { color: COLORS.amber, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "900" }, cueTime: { color: COLORS.muted, flex: 1, fontSize: 11, fontVariant: ["tabular-nums"] }, confidencePill: { backgroundColor: "#173C35", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }, confidenceLow: { backgroundColor: "#4B2925" }, confidenceText: { color: COLORS.mint, fontSize: 10, fontWeight: "800" }, sourceCue: { color: COLORS.paper, fontSize: 15, fontWeight: "700", lineHeight: 21 }, translationCue: { color: "#B4EDE2", fontSize: 14, lineHeight: 20 }, placeholderCue: { color: COLORS.muted, fontStyle: "italic" }, editorFooter: { backgroundColor: COLORS.ink, borderTopColor: "#1E2940", borderTopWidth: 1, flexDirection: "row", gap: 10, padding: 12 },
  exportHero: { alignItems: "center", backgroundColor: COLORS.slate, borderColor: COLORS.line, borderRadius: 20, borderWidth: 1, gap: 10, padding: 25 }, exportHeroTitle: { color: COLORS.paper, fontSize: 19, fontWeight: "800" }, exportHeroBody: { color: "#C1CDE0", fontSize: 13, lineHeight: 19, textAlign: "center" }, exportOption: { alignItems: "center", backgroundColor: COLORS.slate, borderColor: COLORS.line, borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 }, exportOptionIcon: { alignItems: "center", backgroundColor: "#182A44", borderRadius: 11, height: 45, justifyContent: "center", width: 45 }, exportCopy: { flex: 1, gap: 3 }, exportTitle: { color: COLORS.paper, fontSize: 14, fontWeight: "800" }, exportBody: { color: COLORS.muted, fontSize: 11, lineHeight: 16 },
  modalBackdrop: { backgroundColor: "rgba(0,0,0,0.62)", flex: 1, justifyContent: "flex-end" }, modalSheet: { backgroundColor: "#111A2B", borderTopLeftRadius: 26, borderTopRightRadius: 26, gap: 12, maxHeight: "94%", padding: 20 }, modalHandle: { alignSelf: "center", backgroundColor: "#52617B", borderRadius: 9, height: 4, width: 40 }, modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, modalTitle: { color: COLORS.paper, fontSize: 19, fontWeight: "800" }, modalSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 }, inputLabel: { color: "#C1CDE0", fontSize: 12, fontWeight: "800", marginTop: 3 }, textArea: { backgroundColor: "#0B1020", borderColor: COLORS.line, borderRadius: 12, borderWidth: 1, color: COLORS.paper, fontSize: 15, lineHeight: 21, minHeight: 65, padding: 11, textAlignVertical: "top" }, timeEditRow: { flexDirection: "row", gap: 10 }, timeEditor: { flex: 1 }, timeEditorControls: { alignItems: "center", backgroundColor: "#0B1020", borderColor: COLORS.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", height: 42, justifyContent: "space-between", paddingHorizontal: 4 }, timeSmallButton: { alignItems: "center", height: 32, justifyContent: "center", width: 28 }, timeEditValue: { color: COLORS.paper, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "800" }, modalActions: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 5 }, deleteTextButton: { alignItems: "center", flexDirection: "row", gap: 5, paddingVertical: 12 }, deleteText: { color: COLORS.coral, fontSize: 13, fontWeight: "800" }, modalSave: { minWidth: 130 }, inlineButton: { marginTop: 5 },
});
