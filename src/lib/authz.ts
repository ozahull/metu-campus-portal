// Görünürlük / yetki türetmeleri (istemci-tarafı GÖSTERİM kararları). GERÇEK
// yetki her zaman RLS + SECURITY DEFINER RPC'lerdedir; buradaki saf yardımcılar
// yalnızca "butonu/kontrolü göster/gizle" bayraklarını türetir. Bu mantık
// sayfa bileşenlerinde gömülüydü; DAVRANIŞ DEĞİŞMEDEN buraya çıkarıldı ki
// regresyona karşı test edilebilsin (can_edit/can_write NULL tuzağı bu aileden).

/** club_members.role='ADMIN' → kulüp başkanı mı? (profiles'ta 'ADMIN' yoktur,
 *  çakışma olmaz.) trim UYGULANMAZ — çağrı yerindeki özgün davranışla birebir. */
export function isClubPresidentRole(role: string | null | undefined): boolean {
  return (role ?? "").toString().toUpperCase() === "ADMIN";
}

/** Kulüp yönetim yetkisi (Yönet butonu / foto yükleme / kanal açma):
 *  okul VEYA danışman VEYA başkan. */
export function canManageClub(flags: {
  isSuperAdmin: boolean;
  isClubAdvisor: boolean;
  isClubPresident: boolean;
}): boolean {
  return flags.isSuperAdmin || flags.isClubAdvisor || flags.isClubPresident;
}

/** NULL'lanabilir RPC boolean bayrağı → YALNIZ gerçek `true` yetki verir.
 *  can_write_conversation / can_edit gibi RPC'ler auth bağlamı REST çağrısına
 *  taşınamazsa `false` değil SQL NULL döner; `raw === true` guard'ı NULL'u
 *  sessizce "yetkili" saymayı önler (4C QA 2a asimetrisi — regresyon). */
export function rpcGrant(raw: unknown): boolean {
  return raw === true;
}

/** Kendi kaydı mı? isSelf OTURUMDAN türetilir (viewer.id === target.id), RPC
 *  can_edit'inden DEĞİL. İki taraf da gerçek kimlik olmalı — nullish girdi
 *  ASLA self saymaz (null === null tuzağını kapatır). */
export function isSameUser(
  viewerId: string | null | undefined,
  targetId: string | null | undefined,
): boolean {
  return !!viewerId && !!targetId && viewerId === targetId;
}
