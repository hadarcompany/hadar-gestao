"use client";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
} from "lucide-react";
import type { Account, Asset, Target } from "./shared";
import { formats } from "./shared";
import s from "@/app/(authenticated)/publicacoes/social.module.css";
export default function Preview({
  accounts,
  targets,
  assets,
  caption,
  covers,
}: {
  accounts: Account[];
  targets: Target[];
  assets: Asset[];
  caption: string;
  covers: Record<string, Asset>;
}) {
  const [choice, setChoice] = useState(0),
    [index, setIndex] = useState(0);
  useEffect(() => {
    setChoice(0);
    setIndex(0);
  }, [targets.length, assets.length]);
  const target = targets[choice] || targets[0],
    account = accounts.find((a) => a.id === target?.accountId),
    asset = assets[index] || assets[0],
    vertical = target && target.format !== "POST",
    cover = target ? covers[target.accountId] : null;
  return (
    <aside className={s.preview}>
      <div className={s.sectionHeading}>
        <h2>Pré-visualização</h2>
        <span className={s.help}>Aproximação visual</span>
      </div>
      {targets.length > 0 && (
        <label className={s.previewSelect}>
          Canal
          <select
            value={choice}
            onChange={(e) => {
              setChoice(Number(e.target.value));
              setIndex(0);
            }}
          >
            {targets.map((t, i) => (
              <option key={t.accountId + t.format} value={i}>
                {accounts.find((a) => a.id === t.accountId)?.name} ·{" "}
                {formats[t.format]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={`${s.phone} ${vertical ? s.vertical : ""}`}>
        <div className={s.phoneHeader}>
          <span className={s.avatar}>
            {account?.name.slice(0, 1).toUpperCase() || "H"}
          </span>
          <strong>{account?.name || "Seu perfil"}</strong>
          <span>•••</span>
        </div>
        <div className={s.previewMedia}>
          {asset?.previewUrl ? (
            asset.mime === "video/mp4" ? (
              <video
                key={asset.id}
                src={asset.previewUrl}
                poster={cover?.previewUrl || undefined}
                controls
                preload="metadata"
                playsInline
              />
            ) : (
              <img
                src={asset.previewUrl}
                alt={target?.options.altText || "Prévia da publicação"}
              />
            )
          ) : (
            <div className={s.previewEmpty}>
              Adicione a mídia para visualizar aqui.
            </div>
          )}
          {assets.length > 1 && (
            <div className={s.carouselNav}>
              <button
                type="button"
                aria-label="Mídia anterior"
                disabled={index === 0}
                onClick={() => setIndex((i) => i - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                {index + 1} / {assets.length}
              </span>
              <button
                type="button"
                aria-label="Próxima mídia"
                disabled={index >= assets.length - 1}
                onClick={() => setIndex((i) => i + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
        {!vertical && (
          <>
            <div className={s.previewIcons} aria-hidden="true">
              <Heart size={20} />
              <MessageCircle size={20} />
              <Send size={20} />
              <Bookmark size={20} />
            </div>
            <p className={s.previewCaption}>
              <strong>{account?.name || "Seu perfil"}</strong>{" "}
              {caption || "Sua legenda aparece aqui."}
            </p>
          </>
        )}
      </div>
      {vertical && target?.format !== "STORY" && (
        <p className={s.previewCaption}>{caption || "Sem legenda."}</p>
      )}
      <p className={s.help}>
        A rede social define o corte e os elementos finais. Textos escritos no
        editor são incorporados à imagem; a legenda de Stories não aparece sobre
        a mídia.
      </p>
    </aside>
  );
}
