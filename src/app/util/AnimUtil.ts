import { Animation, AnimationController } from "@ionic/angular";

type AnimFactory = (animation: Animation) => Animation;

interface AnimDefinitions {
  [key: string]: AnimFactory;
}

export class AnimUtil {
  public static readonly ANIM_HALF_PULSE: string = "animHalfPulse";
  public static readonly ANIM_PULSE: string = "animPulse";
  public static readonly ANIM_PULSE_2X: string = "animPulse2x";
  public static readonly ANIM_SCALE_IN: string = "animScaleIn";

  public static create(
    animCtrl: AnimationController,
    animation: string,
    el: HTMLElement,
    duration: number = 500,
    delay: number = 0
  ): Promise<void> {
    const f: AnimFactory = AnimUtil.animations[animation];
    if (!f) {
      throw new Error("unknown animation " + animation);
    }
    return f(
      animCtrl.create(animation).addElement(el).duration(duration).delay(delay)
    ).play();
  }

  public static createMultiple(
    animCtrl: AnimationController,
    animation: string,
    elems: HTMLElement[],
    duration: number = 500,
    stagger: number = 100
  ): Promise<any> {
    return Promise.all(
      elems.map((el, i) => {
        console.log(i);
        return AnimUtil.create(animCtrl, animation, el, duration, stagger * i);
      })
    );
  }

  private static animations: AnimDefinitions = {
    [AnimUtil.ANIM_SCALE_IN]: (animation) =>
      animation
        .fromTo("transform", "scale(0)", "scale(1)")
        .fromTo("opacity", 0, 1),
    [AnimUtil.ANIM_HALF_PULSE]: (animation) =>
      animation
        .fromTo("transform", "scale(1.1)", "scale(1)")
        .fromTo("opacity", 0, 1),
    [AnimUtil.ANIM_PULSE]: (animation) =>
      animation.keyframes([
        {
          offset: 0,
          transform: "scale(1)",
        },
        {
          offset: 0.5,
          transform: "scale(1.05)",
        },
        {
          offset: 1,
          transform: "scale(1)",
        },
      ]),
    [AnimUtil.ANIM_PULSE_2X]: (animation) =>
      animation.keyframes([
        {
          offset: 0,
          transform: "scale(1)",
        },
        {
          offset: 0.5,
          transform: "scale(2)",
        },
        {
          offset: 1,
          transform: "scale(1)",
        },
      ]),
  };
}
