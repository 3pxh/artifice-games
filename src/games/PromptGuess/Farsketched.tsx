import { h, Fragment } from "preact";
import { PromptGuessBase, LabeledInput } from "./PromptGuessBase";

export const Farsketched = {
  ...PromptGuessBase,
  Prompt(props: {onSubmit: () => void}) {
    return LabeledInput({
      ...props,
      prefix: "Make something strange!"
    })
  }
}
