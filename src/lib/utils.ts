import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge no conoce los tokens propios del theme de globals.css:
//  - tamaños tipográficos (`text-label-md`...): los confundía con colores y,
//    al lado de un `text-on-surface`, borraba el tamaño.
//  - espaciados/radios/sombras (`p-xl`, `rounded-card`, `shadow-card`...):
//    no los reconocía, así que un `p-0` pasado por className no le ganaba
//    al `p-xl` de base y quedaban los dos.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ["xs", "sm", "md", "lg", "xl", "2xl", "gutter", "gutter-desktop", "margin", "margin-tablet", "margin-desktop"],
      radius: ["card", "inner", "pill"],
      shadow: ["card", "card-hover"],
    },
    classGroups: {
      "font-size": [
        {
          text: [
            "headline-xl",
            "headline-xl-mobile",
            "headline-lg",
            "headline-lg-mobile",
            "headline-md",
            "headline-sm",
            "body-lg",
            "body-md",
            "body-sm",
            "label-lg",
            "label-md",
            "label-sm",
            "label-xs",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
