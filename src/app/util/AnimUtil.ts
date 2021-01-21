import { Animation, AnimationController } from "@ionic/angular";

type AnimFactory = (animation: Animation) => Animation;

interface AnimDefinitions {
  [key: string]: AnimFactory;
}

export class AnimUtil {
  public static readonly ANIM_HALF_PULSE: string = "animHalfPulse";
  public static readonly ANIM_HALF_PULSE_LEFT_JUSTIFIED: string =
    "animHalfPulseLeftJustified";
  public static readonly ANIM_PULSE: string = "animPulse";
  public static readonly ANIM_ITEM_CREATED: string = "animItemCreated";
  public static readonly ANIM_ITEM_DELETED: string = "animItemDeleted";
  public static readonly ANIM_FROM_2X: string = "animFrom2x";
  public static readonly ANIM_PULSE_2X: string = "animPulse2x";
  public static readonly ANIM_SCALE_IN: string = "animScaleIn";
  public static readonly ANIM_SCALE_OUT: string = "animScaleOut";

  public static create(
    animCtrl: AnimationController,
    animation: string,
    el: HTMLElement,
    delay: number = 0
  ): Animation {
    const f: AnimFactory = AnimUtil.animations[animation];
    if (!f) {
      throw new Error("unknown animation " + animation);
    }
    const anim: Animation = animCtrl
      .create(animation)
      .addElement(el)
      .delay(delay);
    return f(anim);
  }

  public static createMultiple(
    animCtrl: AnimationController,
    animation: string,
    elems: HTMLElement[],
    stagger: number = 100
  ): Promise<any> {
    return Promise.all(
      elems.map((el, i) => {
        console.log(i);
        return AnimUtil.create(animCtrl, animation, el, stagger * i);
      })
    );
  }

  public static randRange(min: number, max: number) {
    const ret = Math.random() * (max - min) + min;
    console.log(ret);
    return ret;
  }

  private static animations: AnimDefinitions = {
    [AnimUtil.ANIM_SCALE_IN]: (animation) =>
      animation
        .easing("ease-out")
        .duration(500)
        .fromTo("transform", "scale(0)", "scale(1)"),
    [AnimUtil.ANIM_SCALE_OUT]: (animation) =>
      animation
        .easing("ease-out")
        .duration(500)
        .fromTo("transform", "scale(1)", "scale(0)"),
    [AnimUtil.ANIM_ITEM_DELETED]: (animation) =>
      animation
        .easing("cubic-bezier(.75,0,1,1)")
        .duration(1000)
        .beforeStyles({ position: "relative", "z-index": 999 })
        .fromTo("opacity", 1, 0)
        .fromTo(
          "transform",
          "translateY(0) rotate(0)",
          `translateY(500px) rotateX(${AnimUtil.randRange(
            -350,
            350
          )}deg) rotateZ(${AnimUtil.randRange(-30, 30)}deg)`
          // "translateY(500px) rotate(27deg)"
        ),
    [AnimUtil.ANIM_ITEM_CREATED]: (animation) =>
      animation
        .easing("cubic-bezier(.80,0,1,1)")
        .duration(500)
        .beforeStyles({ position: "relative", "z-index": 999 })
        .fromTo(
          "transform",
          // "translateY(0) scale(2) rotate(27deg)",
          "perspective(500px) translateZ(300px) rotateZ(27deg)",
          "perspective(500px) translateZ(0) rotate(0)"
        )
        .fromTo("opacity", 0, 1)
        .afterClearStyles(["position", "z-index", "transform"]),
    [AnimUtil.ANIM_HALF_PULSE]: (animation) =>
      animation
        .easing("ease-out")
        .fromTo("transform", "scale(1.1)", "scale(1)")
        .duration(500),
    [AnimUtil.ANIM_HALF_PULSE_LEFT_JUSTIFIED]: (animation) =>
      animation
        .easing("ease-out")
        .beforeStyles({ "transform-origin": "left center" })
        .fromTo("transform", "scale(1.2)", "scale(1)")
        .afterClearStyles(["transform-origin"])
        .duration(500),
    [AnimUtil.ANIM_FROM_2X]: (animation) =>
      animation
        .easing("ease-out")
        .fromTo("transform", "scale(2)", "scale(1)")
        .duration(500),
    [AnimUtil.ANIM_PULSE]: (animation) =>
      animation
        .easing("ease-out")
        .keyframes([
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
        ])
        .duration(500),
    [AnimUtil.ANIM_PULSE_2X]: (animation) =>
      animation
        .easing("ease-out")
        .keyframes([
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
        ])
        .duration(500),
  };
}
