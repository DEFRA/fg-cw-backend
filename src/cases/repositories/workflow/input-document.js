export class InputDocument {
  constructor(props) {
    this.type = props.type;
    this.label = props.label;

    // Only assign the optional fields that are set. The driver serialises
    // undefined as null, and a null fails validation on read - both against the
    // field's own type and against the per-type rules, which treat a null key
    // as present (min/max on a text input, for example).
    assignDefined(this, {
      hint: props.hint,
      // text only
      placeholder: props.placeholder,
      pattern: props.pattern,
      maxlength: props.maxlength,
      // number only
      min: props.min,
      max: props.max,
      integer: props.integer,
    });
  }
}

const assignDefined = (target, fields) => {
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
};
