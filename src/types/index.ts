export interface StrategyData {
  hookPattern: string;
  slideStructure: string;
  ctaStyle: string;
  nicheScore: number;
}

export interface SlideData {
  number: number;
  headline: string;
  body: string;
}

export interface ScanResult {
  strategy: StrategyData;
  slides: SlideData[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  persona: Record<string, any>;
  personalMd: string;
}
