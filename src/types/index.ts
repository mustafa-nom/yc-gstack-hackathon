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
  personalMd: string;
}
