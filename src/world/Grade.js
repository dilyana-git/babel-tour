// ── The grade ────────────────────────────────────────────────────────────────
// The last colour decision, made on the finished, tone-mapped frame — the way a
// photograph is printed rather than the way a scene is lit. The look frames the
// world was built from all do the same three things, and a render straight out
// of a renderer does none of them:
//
//   split tone   shadows lean cool (deep teal-blue), highlights lean warm
//                (amber), mid-tones are left alone — so a lamp-lit wall reads
//                warm against a cool dark without either colour being painted
//                into the scene
//   chroma       held down overall (the plates sit near 0.26 saturation), with
//                the brightest things allowed to keep theirs
//   toe          blacks lifted a whisper and rolled, so the dark is a colour
//                and not a hole
//
// And it is not one print but two, crossfaded by where the reader is standing
// (`uCool`, 0 in the Library and 1 out in the garden). The two sets of look
// frames are not in the same key at all: the Library plates measure R-B +10 to
// +33 with the chroma held near 0.26, and the moonlit garden plates measure
// R-B -38 to -57 at 0.59-0.76. Printed as one, the garden came out a warm grey
// — neither the library's amber nor the night's blue.
import { Uniform, Vector3 } from 'three';
import { Effect } from 'postprocessing';

const fragmentShader = /* glsl */ `
  uniform vec3 uShadow;
  uniform vec3 uHighlight;
  uniform vec3 uShadowCool;
  uniform float uSaturation;
  uniform float uSaturationCool;
  uniform float uContrast;
  uniform float uLift;
  uniform float uExposure;
  uniform float uCool;
  uniform vec3 uShadowTint;
  uniform float uGold;
  uniform float uShadowChroma;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb * uExposure;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float lows = 1.0 - smoothstep(0.0, 0.42, l);
    float highs = smoothstep(0.32, 0.95, l);
    vec3 shadow = mix(uShadow, uShadowCool, uCool);
    c = mix(c, c * shadow, lows * mix(0.65, 0.9, uCool));
    c = mix(c, c * uHighlight, highs * 0.45);
    // Gold, not brown: lamp-lit stone comes off the tone curve red-brown (hue
    // ~16), where the look frames' lamplight sits at amber (~33). Carry green
    // up toward red in the WARM pixels only, and only where they are LIT: the
    // frames keep their dark wood red-brown and make the light gold, and pulled
    // all the way down every rail and shelf turned to brass.
    float warm = clamp((c.r - c.b) / max(c.r, 1e-4), 0.0, 1.0);
    c.g += (c.r - c.g) * uGold * warm * smoothstep(0.08, 0.45, l);
    float keep = mix(mix(uSaturation, uSaturationCool, uCool), 1.0, highs * 0.35);
    // Film and eyes both lose colour as the light goes: a dark corner of a
    // lamp-lit room is dark, not dark ORANGE. Without this, every shadow in a
    // room lit only by warm lamps printed as saturated brown. Library only —
    // the garden's night is meant to be a deep, saturated blue.
    keep *= mix(1.0, mix(uShadowChroma, 1.0, smoothstep(0.02, 0.3, l)), 1.0 - uCool);
    c = mix(vec3(l), c, keep);
    c = (c - 0.36) * uContrast + 0.36;
    c = c + uLift * (1.0 - smoothstep(0.0, 0.25, l)) * vec3(0.78, 0.88, 1.0);
    // The dark as a colour: a split tone MULTIPLIES, and a near-black times
    // teal is still black, so the look frames' teal shadows (a quarter of
    // their dark pixels are cool) need the tint ADDED where the frame is dark.
    c = c + uShadowTint * (1.0 - smoothstep(0.0, 0.12, l)) * (1.0 - uCool);
    outputColor = vec4(max(c, 0.0), inputColor.a);
  }
`;

// Where the reader is standing, for the crossfade between the two prints: 0
// among the walls, 1 out under the moon. Deliberately NOT a React ref —
// @react-three/postprocessing's wrapEffect does `useMemo(..., [JSON.stringify(props)])`
// and under React 19 a ref IS a prop, so handing one in serialises the effect's
// own three.js parent chain and the whole composer throws (the frame goes
// black, silently, with nothing but a circular-structure error). The effect
// reads this in its own update(), which is where per-frame values belong.
export const gradePlace = { cool: 0 };

export class GradeEffect extends Effect {
  constructor({
    shadow = [0.82, 0.95, 1.08],
    shadowCool = [0.48, 0.76, 1.38],
    highlight = [1.08, 1.0, 0.86],
    saturation = 0.8,
    saturationCool = 0.96,
    contrast = 1.06,
    lift = 0.012,
    exposure = 1.0,
    cool = 0,
    shadowTint = [0, 0, 0],
    gold = 0,
    shadowChroma = 1,
  } = {}) {
    super('GradeEffect', fragmentShader, {
      uniforms: new Map([
        ['uExposure', new Uniform(exposure)],
        ['uShadow', new Uniform(new Vector3(...shadow))],
        ['uShadowCool', new Uniform(new Vector3(...shadowCool))],
        ['uHighlight', new Uniform(new Vector3(...highlight))],
        ['uSaturation', new Uniform(saturation)],
        ['uSaturationCool', new Uniform(saturationCool)],
        ['uContrast', new Uniform(contrast)],
        ['uLift', new Uniform(lift)],
        ['uCool', new Uniform(cool)],
        ['uShadowTint', new Uniform(new Vector3(...shadowTint))],
        ['uGold', new Uniform(gold)],
        ['uShadowChroma', new Uniform(shadowChroma)],
      ]),
    });
  }

  update() {
    this.uniforms.get('uCool').value = gradePlace.cool;
  }
}
