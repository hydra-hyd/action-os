/**
 * ルールベースのタスク分解（AI未接続時のフォールバック）。
 * AIではないことをUIで明示すること。
 */
export interface Decomposition {
  firstAction: string;
  steps: string[];
  goals: { minimum: string; normal: string; stretch: string };
  source: "ai" | "rules";
}

const PATTERNS: { re: RegExp; first: string; steps: string[] }[] = [
  {
    re: /勉強|学習|試験|復習|宿題|課題|講義|テキスト/,
    first: "テキスト（または教材）を開く",
    steps: ["机に座る", "テキストを開く", "前回の範囲を1問だけ復習する", "15分だけ取り組む", "理解度を一言メモする"],
  },
  {
    re: /筋トレ|運動|ジム|ランニング|ストレッチ|散歩/,
    first: "トレーニングウェアに着替える",
    steps: ["ウェアに着替える", "1種目だけやる", "もう1セットやるか決める", "終わったら水を飲んで記録する"],
  },
  {
    re: /プログラ|コード|実装|開発|バグ|アプリ/,
    first: "IDE（エディタ）を起動する",
    steps: ["エディタを起動する", "対象ファイルを開く", "やることを1行コメントで書く", "最小の変更を1つ入れる", "動作確認して次の一手をメモする"],
  },
  {
    re: /読書|本|読む/,
    first: "本を開いて1ページ目を見る",
    steps: ["本を手に取る", "1ページ読む", "10分読む", "印象に残った一文をメモする"],
  },
  {
    re: /掃除|片付け|整理|洗濯|洗い物/,
    first: "ゴミを1個捨てる",
    steps: ["ゴミを1個捨てる", "目に入る1か所だけ片付ける", "5分タイマーで続ける"],
  },
  {
    re: /レポート|資料|書く|執筆|文章|メール|企画/,
    first: "ファイルを開いてタイトルだけ書く",
    steps: ["ファイルを開く", "タイトルと見出しを3つ書く", "1つの見出しに箇条書きで3行書く", "下書きのまま保存する"],
  },
];

export function ruleBasedDecompose(title: string): Decomposition {
  const p = PATTERNS.find((x) => x.re.test(title));
  if (p) {
    return {
      firstAction: p.first,
      steps: p.steps,
      goals: {
        minimum: `${p.first}（ここまでで今日は合格）`,
        normal: `「${title}」を予定どおり進める`,
        stretch: `余裕があれば「${title}」をもう一歩先まで進める`,
      },
      source: "rules",
    };
  }
  return {
    firstAction: `「${title}」に必要なものを1つ手元に出す`,
    steps: ["必要な道具・ファイルを1つ用意する", "やることを1行で書き出す", "5分だけ取り組む", "続けるか、次の一手をメモして終えるか決める"],
    goals: {
      minimum: "5分だけ取り組む",
      normal: `「${title}」を予定どおり進める`,
      stretch: "余裕があれば次の段階まで進める",
    },
    source: "rules",
  };
}
