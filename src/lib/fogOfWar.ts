export function isFogOfWarEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FOG_OF_WAR_ENABLED === 'true';
}
