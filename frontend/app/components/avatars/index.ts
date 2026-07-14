import { ComponentType } from "react";
import SenseiAvatar from "./sensei";
import TenchoAvatar from "./tencho";
import TomodachiAvatar from "./tomodachi";
import IshaAvatar from "./isha";
import UntenshuAvatar from "./untenshu";
import EkinAvatar from "./ekin";
import KanriinAvatar from "./kanriin";
import CustomAvatar from "./custom";
import { AvatarProps } from "../Avatar";

export const avatars: Record<string, ComponentType<AvatarProps>> = {
  sensei: SenseiAvatar,
  tencho: TenchoAvatar,
  tomodachi: TomodachiAvatar,
  isha: IshaAvatar,
  untenshu: UntenshuAvatar,
  ekin: EkinAvatar,
  kanriin: KanriinAvatar,
  custom: CustomAvatar,
};
