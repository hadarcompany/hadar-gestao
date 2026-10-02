import assert from "node:assert/strict";
import { test } from "node:test";
import { IMAGE_FILE_ACCEPT, imageMimeType, isHeicImage, isImageFile, isPreviewableImage, prepareImageForDisplay } from "../lib/image-files";
import { heicToJpeg } from "../lib/heic";
import { addTaskImages, MAX_TASK_IMAGE_BYTES, transferredFiles } from "../lib/task-images";

test("HEIC/HEIF são aceitos com MIME ausente, genérico e extensão maiúscula", () => {
  for (const name of ["foto.heic", "FOTO.HEIC", "foto.heif", "FOTO.HEIF"]) {
    for (const type of ["", "application/octet-stream"]) {
      const file = { name, type };
      assert.ok(isHeicImage(file));
      assert.ok(isImageFile(file));
      assert.ok(isPreviewableImage(file));
      assert.equal(imageMimeType(file), name.toLowerCase().endsWith(".heif") ? "image/heif" : "image/heic");
    }
  }
  assert.ok(IMAGE_FILE_ACCEPT.includes(".heic"));
  assert.ok(IMAGE_FILE_ACCEPT.includes(".heif"));
});

test("MIME HEIC e HEIF são reconhecidos mesmo sem extensão", () => {
  for (const type of ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]) {
    assert.ok(isImageFile({ name: "foto", type }));
    assert.ok(isPreviewableImage({ name: "foto", type }));
  }
});

test("anexos HEIC antigos com MIME genérico têm prévia pelo nome", () => {
  assert.ok(isPreviewableImage({ fileName: "foto.HEIC", mimeType: "application/octet-stream" }));
  assert.ok(isPreviewableImage({ fileName: "foto.HEIF", mimeType: "" }));
});

test("formatos existentes mantêm seu MIME e SVG/PDF continuam sem prévia inline", () => {
  for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
    assert.ok(isImageFile({ name: "foto", type }));
    assert.ok(isPreviewableImage({ name: "foto", type }));
    assert.equal(imageMimeType({ name: "foto", type }), type);
  }
  assert.equal(isPreviewableImage({ name: "logo.svg", type: "image/svg+xml" }), false);
  assert.equal(isPreviewableImage({ name: "doc.pdf", type: "application/pdf" }), false);
  assert.equal(isImageFile({ name: "doc.pdf", type: "" }), false);
  assert.equal(imageMimeType({ name: "doc.pdf", type: "" }), "application/octet-stream");
});

test("foto de perfil HEIC envia o original para conversão e recebe JPEG", async (context) => {
  const file = new File(["heic"], "foto.HEIC", { type: "application/octet-stream" });
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
  context.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    assert.equal(url, "/api/images/convert");
    assert.equal(options.method, "POST");
    const uploaded = (options.body as FormData).get("file") as File;
    assert.equal(uploaded.name, "foto.HEIC");
    assert.equal(await uploaded.text(), "heic");
    return new Response(jpeg, { headers: { "Content-Type": "image/jpeg" } });
  });
  const result = await prepareImageForDisplay(file);
  assert.equal(result.type, "image/jpeg");
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array(await jpeg.arrayBuffer()));
});

test("foto de perfil JPEG não faz pedido de conversão", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => { throw new Error("Pedido inesperado"); });
  const file = new File(["jpeg"], "foto.jpg", { type: "image/jpeg" });
  assert.equal(await prepareImageForDisplay(file), file);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("erro de conversão é apresentado ao usuário", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ error: "Imagem HEIC inválida" }, { status: 400 }));
  await assert.rejects(prepareImageForDisplay(new File(["invalid"], "foto.heic")), /Imagem HEIC inválida/);
});

test("decoder rejeita arquivo inválido com mensagem em português", async () => {
  await assert.rejects(heicToJpeg(Buffer.from("arquivo inválido")), /Não foi possível converter a imagem HEIC/);
});

test("imagens comuns copiadas do computador são aceitas mesmo sem MIME", () => {
  for (const name of ["foto.JPG", "foto.jpeg", "foto.PNG", "foto.webp", "foto.gif", "foto.avif"]) {
    assert.ok(isImageFile({ name, type: "" }));
    assert.ok(isImageFile({ name, type: "application/octet-stream" }));
    assert.ok(imageMimeType({ name, type: "" }).startsWith("image/"));
  }
});

test("colagem usa files quando items está vazio", () => {
  const file = new File(["heic"], "foto.HEIC");
  const transfer = { files: [file], items: [] } as unknown as DataTransfer;
  assert.deepEqual(transferredFiles(transfer), [file]);
});

test("colagem usa items quando files está vazio e ignora texto e arquivos nulos", () => {
  const file = new File(["png"], "foto.png", { type: "image/png" });
  const transfer = {
    files: [],
    items: [
      { kind: "string", getAsFile: () => null },
      { kind: "file", getAsFile: () => file },
      { kind: "file", getAsFile: () => null },
    ],
  } as unknown as DataTransfer;
  assert.deepEqual(transferredFiles(transfer), [file]);
  assert.deepEqual(transferredFiles(null), []);
});

test("transferência não duplica imagens expostas tanto em files quanto em items", () => {
  const file = new File(["png"], "foto.png");
  const transfer = { files: [file], items: [{ kind: "file", getAsFile: () => file }] } as unknown as DataTransfer;
  assert.deepEqual(transferredFiles(transfer), [file]);
});

test("seleção, colagem e arrastar preservam HEIC original e mostram arquivos rejeitados", () => {
  const heic = new File(["heic original"], "foto.heic");
  const png = new File(["png"], "foto.png");
  const result = addTaskImages([], [heic, new File([], "vazia.png"), new File(["pdf"], "documento.pdf"), png]);
  assert.deepEqual(result.files, [heic, png]);
  assert.equal(result.added[0], heic);
  assert.match(result.error!, /vazia.png.*vazio/);
  assert.match(result.error!, /documento.pdf.*imagem/);
});

test("limites de 10 imagens e 8 MB são respeitados com erro explícito", () => {
  const current = Array.from({ length: 9 }, (_, i) => new File(["png"], `${i}.png`));
  const result = addTaskImages(current, [new File(["png"], "aceita.png"), new File(["png"], "excedente.png")]);
  assert.equal(result.files.length, 10);
  assert.equal(result.added.length, 1);
  assert.match(result.error!, /até 10 imagens/);
  const exact = new File([new Uint8Array(MAX_TASK_IMAGE_BYTES)], "limite.heic");
  assert.equal(addTaskImages([], [exact]).added.length, 1);
  const tooLarge = new File([new Uint8Array(MAX_TASK_IMAGE_BYTES + 1)], "grande.heic");
  assert.match(addTaskImages([], [tooLarge]).error!, /8 MB/);
});
