/** Conversão executada somente nas rotas do servidor; o decoder não vai para o cliente. */
export async function heicToJpeg(buffer: Uint8Array): Promise<Buffer> {
  try {
    const { default: convert } = await import("heic-convert");
    const jpeg = await convert({ buffer, format: "JPEG", quality: 0.9 });
    return Buffer.from(jpeg);
  } catch {
    throw new Error("Não foi possível converter a imagem HEIC. Verifique se o arquivo é válido.");
  }
}
