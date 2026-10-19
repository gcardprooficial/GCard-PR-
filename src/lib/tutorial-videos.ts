// Vídeos tutoriais (YouTube Shorts). Um lugar só: site, e-mails, WhatsApp e guia leem daqui.
// O canal anterior foi removido; estes são os vídeos no canal novo.
export const TUTORIAL_VIDEOS = { qr: "nsWdLR_xl_I", nfc: "hO66jMPCPcA" } as const;

export const shortsUrl = (id: string) => `https://youtube.com/shorts/${id}`;
export const TUTORIAL_QR_URL = shortsUrl(TUTORIAL_VIDEOS.qr);
export const TUTORIAL_NFC_URL = shortsUrl(TUTORIAL_VIDEOS.nfc);
