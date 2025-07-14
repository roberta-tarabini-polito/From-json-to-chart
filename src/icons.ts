export const SIMULINK_ICONS = {
  'Constant': `<path d="M8 2v12h8V2H8zm6 10H10V4h4v8z"/>`,
  'Sum': `<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>`,
  'Gain': `<path d="M2 12L12 2l10 10L12 22z"/>`,
  'Integrator': `<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M10 10h4M12 8v8"/>`,
  'Scope': `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 14l3-3 3 3 3-3"/>`,
  'Step': `<path d="M3 17h4V7h4v10h4V3h4"/>`,
  'Transfer Fcn': `<rect x="4" y="8" width="16" height="8" rx="1"/><text x="12" y="13" text-anchor="middle" font-size="8">s</text>`,
  'PID Controller': `<rect x="4" y="6" width="16" height="12" rx="2"/><text x="12" y="13" text-anchor="middle" font-size="6">PID</text>`
};

export function getBlockIcon(blockType: string): string {
  return SIMULINK_ICONS[blockType as keyof typeof SIMULINK_ICONS] || SIMULINK_ICONS['Constant'];
}
