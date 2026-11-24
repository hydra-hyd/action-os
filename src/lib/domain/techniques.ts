import type { Blocker } from "./types";

/**
 * 心理テクニックの静的カタログ（MVP）。
 *
 * 重要：Notion 本文はまだ同期していない（Phase 4 で Notion API + RAG を実装予定）。
 * 下記の手順は「ACTION OS 要件定義書」に書かれた記述をもとにした一般的な手順であり、
 * Notion 資料の内容を要約・再現したものではない。sourceStatus で取得状況を明示する。
 */
export interface Technique {
  id: string;
  name: string;
  category: "速攻" | "CBT" | "ACT" | "習慣" | "環境" | "休息";
  steps: string[];
  minutes: number;
  caution?: string;
  source: { title: string; url: string | null };
  sourceStatus: "notion_unsynced" | "requirements_only";
}

const N = (title: string, id: string) => ({ title, url: `https://app.notion.com/p/${id}` });

export const TECHNIQUES: Technique[] = [
  {
    id: "thirty_sec",
    name: "30秒アクション",
    category: "速攻",
    steps: ["タスクの「最初の30秒の行動」だけを見る", "タイマー30秒で、それだけやる", "続けたければ続ける。やめても着手として記録される"],
    minutes: 1,
    source: N("速攻：先延ばしを潰す技術", "3996657d487980c09388ee2db0c4e81c"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "imperfect_start",
    name: "不完全な着手",
    category: "速攻",
    steps: ["「下書き」「試し」「練習」と名前を付けて始める", "品質の基準を最低目標まで下げる", "5分後に続けるか決める"],
    minutes: 5,
    source: N("速攻：先延ばしを潰す技術", "3996657d487980c09388ee2db0c4e81c"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "defusion",
    name: "脱フュージョン：「〜という考えを持っている」",
    category: "ACT",
    steps: [
      "頭に浮かんだ言葉をそのまま書く（例：自分にはできない）",
      "「私は今、〜という考えを持っている」と言い換える",
      "その考えがあっても実行できる、いちばん小さい行動を1つ選ぶ",
    ],
    minutes: 2,
    source: N("ディフュージョン", "13f6657d487980d49871e21c46672876"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "present_moment",
    name: "現在への接続：5つの気づき",
    category: "ACT",
    steps: ["見えるものを5つ挙げる", "聞こえる音を3つ挙げる", "体の感覚を1つ感じる", "呼吸を3回観察してから、最初の行動へ"],
    minutes: 2,
    source: N("コネクト・ウィズ・モーメント", "13f6657d48798017a9e2fc2fe0061c50"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "reframe",
    name: "認知再構成（完璧主義）",
    category: "CBT",
    steps: [
      "その考えを支持する証拠は？",
      "反対の証拠は？",
      "完璧でなくても価値はある？",
      "友人が同じ状況なら何と伝える？",
      "今できる現実的な行動は？（最低目標を確認）",
    ],
    minutes: 3,
    caution: "思考を否定するのが目的ではありません。行動できる見方を探す練習です。",
    source: { title: "要件定義書 7.4 認知再構成", url: null },
    sourceStatus: "requirements_only",
  },
  {
    id: "behavior_activation",
    name: "行動活性化",
    category: "CBT",
    steps: ["気分が良くなるのを待たずに、5分でできる意味のある行動を選ぶ", "やってみる", "終わったら達成感・気分を一言メモ"],
    minutes: 5,
    source: { title: "要件定義書 7.6 行動活性化", url: null },
    sourceStatus: "requirements_only",
  },
  {
    id: "behavior_experiment",
    name: "行動実験",
    category: "CBT",
    steps: ["やる前に「どれくらい嫌か（0〜100）」を予測する", "最低目標だけやってみる", "実際の嫌さを記録し、予測と比べる"],
    minutes: 5,
    source: { title: "要件定義書 7.5 行動実験", url: null },
    sourceStatus: "requirements_only",
  },
  {
    id: "urge_surfing",
    name: "衝動のサーフィン",
    category: "ACT",
    steps: ["衝動を消そうとせず、体のどこに感じるか観察する", "呼吸10回のあいだ、波が高まり引いていく様子を見る", "価値観に沿った行動を1つ選ぶ"],
    minutes: 2,
    source: N("エキスパンション", "13f6657d487980dc800ee39a1c73f796"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "environment",
    name: "環境設計（誘惑への摩擦）",
    category: "環境",
    steps: ["スマホを別の部屋か手の届かない場所に置く", "通知をオフにする", "作業に必要なものだけを机に出す"],
    minutes: 1,
    source: N("多忙無力感：ジョブコントロール・判断ミニマリズム・反応ミニマリズム", "3f36657d4879803c9a25cb3204128b9a"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "values_check",
    name: "価値観の再確認",
    category: "ACT",
    steps: ["このタスクは、自分が大切にしている何につながる？", "それを一言で書く", "その方向への最小の一歩を選ぶ"],
    minutes: 2,
    source: N("ACTの基本原則", "13f6657d48798007809aeef6d0fff5c5"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "past_success",
    name: "過去の成功体験の想起",
    category: "CBT",
    steps: ["これまでに完了・着手できた記録を見る", "そのとき何が役に立ったか思い出す", "同じ方法で最初の行動をする"],
    minutes: 1,
    source: { title: "要件定義書 18.3 介入選択ルール", url: null },
    sourceStatus: "requirements_only",
  },
  {
    id: "breakdown",
    name: "タスク分解",
    category: "速攻",
    steps: ["タスクを「机に座る」レベルの行動に分ける", "1つ目だけを今やる"],
    minutes: 2,
    source: N("速攻：先延ばしを潰す技術", "3996657d487980c09388ee2db0c4e81c"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "decision_minimalism",
    name: "判断ミニマリズム",
    category: "環境",
    steps: ["今は「最重要タスク」1つだけを見る", "他のタスクは明日以降に回してよい", "その1つの30秒アクションから始める"],
    minutes: 1,
    source: N("多忙無力感：ジョブコントロール・判断ミニマリズム・反応ミニマリズム", "3f36657d4879803c9a25cb3204128b9a"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "difficulty_tune",
    name: "難易度調整",
    category: "習慣",
    steps: ["飽きているなら、少し難しくする or やり方を変える", "制限時間を付けてゲームにする", "終わったら経験値を確認する"],
    minutes: 1,
    source: N("9つのフロー条件", "13f6657d4879806bb199d3630f691319"),
    sourceStatus: "notion_unsynced",
  },
  {
    id: "rest",
    name: "休息・負荷軽減",
    category: "休息",
    steps: ["休むことは正当な選択です", "5〜20分休む、または最低目標だけにする", "必要なら今日は中止して再計画する"],
    minutes: 10,
    caution: "強い不調が続くときは、医師などの専門家への相談も検討してください。",
    source: { title: "要件定義書 24.5 安全性", url: null },
    sourceStatus: "requirements_only",
  },
];

export const BLOCKER_LABEL: Record<Blocker, string> = {
  bother: "面倒くさい",
  no_motivation: "やる気がない",
  fear_failure: "失敗が怖い",
  perfectionism: "完璧にできない",
  anxiety: "不安が強い",
  no_confidence: "自信がない",
  phone: "スマホを触りたい",
  tired: "疲れている",
  meaningless: "意味を感じない",
  where_to_start: "何から始めるか分からない",
  too_many: "タスクが多すぎる",
  bored: "飽きている",
  other: "その他",
};

/** 要件 18.3 心理介入の選択ルール（推奨順） */
export const INTERVENTION_RULES: Record<Blocker, string[]> = {
  bother: ["thirty_sec", "breakdown"],
  no_motivation: ["behavior_activation", "thirty_sec"],
  fear_failure: ["behavior_experiment", "imperfect_start"],
  perfectionism: ["reframe", "imperfect_start"],
  anxiety: ["defusion", "present_moment"],
  no_confidence: ["past_success", "defusion"],
  phone: ["urge_surfing", "environment"],
  tired: ["rest", "behavior_activation"],
  meaningless: ["values_check", "behavior_activation"],
  where_to_start: ["breakdown", "thirty_sec"],
  too_many: ["decision_minimalism", "breakdown"],
  bored: ["difficulty_tune", "imperfect_start"],
  other: ["thirty_sec", "defusion"],
};

export function techniqueById(id: string): Technique | undefined {
  return TECHNIQUES.find((t) => t.id === id);
}

export function recommendTechniques(blocker: Blocker): Technique[] {
  return INTERVENTION_RULES[blocker].map(techniqueById).filter((t): t is Technique => !!t);
}

/** 脱フュージョンの言い換え（要件 8.1） */
export function defuse(thought: string): string {
  const t = thought.trim().replace(/[。.!！]+$/, "");
  if (!t) return "";
  return `私は今、「${t}」という考えを持っている。`;
}
