/** Filon — composants. Chargés comme window.Filon (React 18 requis sur la page). */
export interface ButtonProps { variant?: "primary" | "ghost"; type?: "button" | "submit"; disabled?: boolean; onClick?: () => void; className?: string; children: React.ReactNode }
export function Button(props: ButtonProps): JSX.Element;

export interface ScoreDialProps { /** 0-100 */ value: number; /** px, 96 par défaut */ size?: number; /** or à partir de, 60 par défaut */ threshold?: number; label?: string; className?: string }
export function ScoreDial(props: ScoreDialProps): JSX.Element;

export interface SignalChipProps { kind: "cession" | "decote" | "valeur"; className?: string; children: React.ReactNode }
export function SignalChip(props: SignalChipProps): JSX.Element;

export interface ProcedureTagProps { type: "liquidation" | "redressement" | "sauvegarde" | "plan_cession" | "cedant" | "veille"; className?: string; children?: React.ReactNode }
export function ProcedureTag(props: ProcedureTagProps): JSX.Element;

export interface RadarPoint { /** 0-1 */ x: number; /** 0-1 */ y: number; /** 0-100 */ score: number; label?: string }
export interface RadarProps { points: RadarPoint[]; size?: number; hotThreshold?: number; selected?: number; onSelect?: (index: number, point: RadarPoint) => void; ariaLabel?: string; className?: string }
export function Radar(props: RadarProps): JSX.Element;
