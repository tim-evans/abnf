(function (exports) {

// .............................................
// UTILITY FUNCTIONS
//
var o_toString = Object.prototype.toString;
var isArray = Array.isArray || function (o) {
  return o_toString.call(o) === 'array';
};

// .............................................
// PARSING LOGIC
//

var WSP = [' ', '\t'],
    CRLF = '\n',
    ALPHA = /[a-zA-Z]/,
    DIGIT = /[0-9]/,
    DQUOTE = '"',
    BIT = /[0|1]/,
    HEXDIG = /[0-9a-fA-F]/;

var extractRuleList = function (string) {
  string += '\n';
  var rulelist = [];
  rulelist.cursor = 0;

  if (!(extractRule(string, rulelist) ||
        extractCommentNewline(string, rulelist))) {
    throw new Error("A <rule-list> requires at least one rule");
  }
  while (extractRule(string, rulelist) ||
         extractCommentNewline(string, rulelist)) {};
  return rulelist;
};

var extractRule = function (string, rulelist) {
  var rule = {},
      tokens = [];
  tokens.cursor = rulelist.cursor;

  if (extractRuleName(string, tokens)) {
    if (extractDefinedAs(string, tokens)) {
      if (extractElements(string, tokens)) {
        if (extractCommentNewline(string, tokens) ||
            tokens.cursor === string.length) {
          rulelist.push({
            type: 'rule',
            value: tokens
          });
          rulelist.cursor = tokens.cursor;
          return true;
        }
      }
    }
  }
  return false;
};

var extractRuleName = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      ruleName = '';

  if (ALPHA.test(chr)) {
    while (ALPHA.test(chr) ||
           DIGIT.test(chr) ||
           chr === '-') {
      ruleName += chr;
      chr = string.charAt(++tokens.cursor);
    }
    tokens.push({
      type: 'rulename',
      value: ruleName
    });
    return true;
  }
  return false;
};

var extractDefinedAs = function (string, tokens) {
  while (extractCommentWhiteSpace(string, tokens)) {}
  if (string.indexOf('=/', tokens.cursor) === tokens.cursor) {
    tokens.push({
      type: 'defined-as',
      value: '=/'
    });
    tokens.cursor += 2;
  } else if (string.indexOf('=', tokens.cursor) === tokens.cursor) {
    tokens.push({
      type: 'defined-as',
      value: '='
    });
    tokens.cursor++;
  } else {
    return false;
  }
  while (extractCommentWhiteSpace(string, tokens)) {}
  return true;
};

var extractElements = function (string, tokens) {
  var elements = [];
  elements.cursor = tokens.cursor;
  if (extractAlternation(string, elements)) {
    while (extractCommentWhiteSpace(string, elements)) {}
    tokens.push({
      type: 'elements',
      value: elements
    });
    tokens.cursor = elements.cursor;
    return true;
  }
  return false;
};

var extractCommentWhiteSpace = function (string, rule) {
  var tokens = [];
  tokens.cursor = rule.cursor;

  var chr = string.charAt(rule.cursor);
  if (WSP.indexOf(chr) !== -1) {
    rule.cursor++;
    return true;
  } else {
    if (extractCommentNewline(string, tokens)) {
      if (WSP.indexOf(string.charAt(tokens.cursor)) !== -1) {
        rule.push(tokens[0]);
        rule.cursor = tokens.cursor;
        return true;
      }
    }
  }
  return false;
};

var extractCommentNewline = function (string, rule) {
  var chr = string.charAt(rule.cursor);
  if (extractComment(string, rule)) {
    return true;
  } else if (chr === CRLF) {
    rule.cursor++;
    return true;
  }
  return false;
};

var extractComment = function (string, tokens) {
  if (string.charAt(tokens.cursor) === ';') {
    var iCRLF = string.indexOf(CRLF, tokens.cursor);
    tokens.push({
      type: 'comment',
      value: string.slice(tokens.cursor + 1, iCRLF)
    });
    tokens.cursor = iCRLF + 1;
    return true;
  }
  return false;
};

var extractAlternation = function (string, tokens) {
  var alternatives = [];
  alternatives.cursor = tokens.cursor;

  if (extractConcatenation(string, alternatives)) {
    while (true) {
      while (extractCommentWhiteSpace(string, alternatives)) {}
      if (string.charAt(alternatives.cursor) === '/') {
        alternatives.cursor++;
      }
      while (extractCommentWhiteSpace(string, alternatives)) {}
      if (!extractConcatenation(string, alternatives)) break;
    }
    tokens.push({
      type: 'alternation',
      value: alternatives
    });
    tokens.cursor = alternatives.cursor;
    return true;
  }
  return false;
};

var extractConcatenation = function (string, tokens) {
  var concatenation = [];
  concatenation.cursor = tokens.cursor;

  if (extractRepetition(string, concatenation)) {
    while (true) {
      if (!extractCommentWhiteSpace(string, concatenation)) {
        break;
      }
      while (extractCommentWhiteSpace(string, concatenation)) {}
      if (!extractRepetition(string, concatenation)) {
        break;
      }
    }
    tokens.push({
      type: 'concatenation',
      value: concatenation
    });
    tokens.cursor = concatenation.cursor;
    return true;
  }
  return false;
};

var extractRepetition = function (string, tokens) {
  var repetition = [];
  repetition.cursor = tokens.cursor;

  extractRepeat(string, repetition);
  if (extractElement(string, repetition)) {
    tokens.push({
      type: 'repetition',
      value: repetition
    });
    tokens.cursor = repetition.cursor;
    return true;
  }
  return false;
};

var extractRepeat = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      value = '';

  while (DIGIT.test(chr)) {
    value += chr;
    chr = string.charAt(++tokens.cursor);
  }

  if (chr === '*') {
    value += chr;
    chr = string.charAt(++tokens.cursor);
    while (DIGIT.test(chr)) {
      value += chr;
      chr = string.charAt(++tokens.cursor);
    }
  }

  if (value.length) {
    tokens.push({
      type: 'repeat',
      value: value
    });
    return true;
  }
  return false;
};

var extractElement = function (string, tokens) {
  if (extractRuleName(string, tokens) ||
      extractGroup(string, tokens) ||
      extractOption(string, tokens) ||
      extractCharVal(string, tokens) ||
      extractNumVal(string, tokens) ||
      extractProseVal(string, tokens)) {
    tokens.push({
      type: 'element',
      value: tokens.pop()
    });
    return true;
  }
  return false;
};

var extractGroup = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      group = [];
  group.cursor = tokens.cursor;

  if (chr === '(') {
    group.cursor++;
    while (extractCommentWhiteSpace(string, group)) {};
    extractAlternation(string, group);
    while (extractCommentWhiteSpace(string, group)) {};
    chr = string.charAt(group.cursor);
    if (chr === ')') {
      tokens.push({
        type: 'group',
        value: group
      });
      tokens.cursor = group.cursor + 1;
      return true;
    }
  }
  return false;
};

var extractOption = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      option = [];
  option.cursor = tokens.cursor;

  if (chr === '[') {
    option.cursor++;
    while (extractCommentWhiteSpace(string, option)) {};
    extractAlternation(string, option);
    while (extractCommentWhiteSpace(string, option)) {};
    chr = string.charAt(option.cursor);
    if (chr === ']') {
      tokens.push({
        type: 'option',
        value: option
      });
      tokens.cursor = option.cursor + 1;
      return true;
    }
  }
  return false;
};

var extractCharVal = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      str = '',
      code;
  if (chr === DQUOTE) {
    while (true) {
      chr = string.charAt(++tokens.cursor);
      code = chr.charCodeAt(0);
      if (code === 0x20 || code === 0x21) {
        str += chr;
      } else if (code >= 0x23 && code <= 0x7E) {
        str += chr;
      } else if (chr === DQUOTE || chr === '') {
        break;
      } else {
        throw new Error("Invalid character value '%@'".fmt(chr));
      }
    }

    if (chr === DQUOTE) {
      tokens.push({
        type: 'char-val',
        value: str
      });
      tokens.cursor++;
      return true;
    } else {
      return false;
    }
  }
  return false;
};

var extractNumVal = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      value;

  if (chr === '%') {
    tokens.cursor++;
    if (extractBinVal(string, tokens) ||
        extractDecVal(string, tokens) ||
        extractHexVal(string, tokens)) {
      tokens.push({
        type: 'num-val',
        value: tokens.pop()
      });
      return true;
    }
    return false;
  }
  return false;
};

var extractBinVal = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      val = '';

  if (chr === 'b') {
    chr = string.charAt(++tokens.cursor);
    if (BIT.test(chr)) {
      while (BIT.test(chr)) {
        val += chr;
        chr = string.charAt(++tokens.cursor);
      }

      if (chr === '.' &&
          BIT.test(string.charAt(tokens.cursor + 1))) {
        while (chr === '.' &&
               BIT.test(string.charAt(tokens.cursor + 1))) {
          val += chr;
          chr = string.charAt(++tokens.cursor);
          while (BIT.test(chr)) {
            val += chr;
            chr = string.charAt(++tokens.cursor);
          }
        }
      } else if (chr === '-' &&
                 BIT.test(string.charAt(tokens.cursor + 1))) {
        val += chr;
        chr = string.charAt(++tokens.cursor);
        while (BIT.test(chr)) {
          val += chr;
          chr = string.charAt(++tokens.cursor);
        }
      }

      tokens.push({
        type: 'bin-val',
        value: val
      });
      return true;
    }
    return false;
  }
  return false;
};

var extractDecVal = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      val = '';

  if (chr === 'd') {
    chr = string.charAt(++tokens.cursor);
    if (DIGIT.test(chr)) {
      while (DIGIT.test(chr)) {
        val += chr;
        chr = string.charAt(++tokens.cursor);
      }

      if (chr === '.' &&
          DIGIT.test(string.charAt(tokens.cursor + 1))) {
        while (chr === '.' &&
               DIGIT.test(string.charAt(tokens.cursor + 1))) {
          val += chr;
          chr = string.charAt(++tokens.cursor);
          while (DIGIT.test(chr)) {
            val += chr;
            chr = string.charAt(++tokens.cursor);
          }
        }
      } else if (chr === '-' &&
                 DIGIT.test(string.charAt(tokens.cursor + 1))) {
        val += chr;
        chr = string.charAt(++tokens.cursor);
        while (DIGIT.test(chr)) {
          val += chr;
          chr = string.charAt(++tokens.cursor);
        }
      }

      tokens.push({
        type: 'dec-val',
        value: val
      });
      return true;
    }
    return false;
  }
  return false;
};

var extractHexVal = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      val = '';

  if (chr === 'x') {
    chr = string.charAt(++tokens.cursor);
    if (HEXDIG.test(chr)) {
      while (HEXDIG.test(chr)) {
        val += chr;
        chr = string.charAt(++tokens.cursor);
      }

      if (chr === '.' &&
          HEXDIG.test(string.charAt(tokens.cursor + 1))) {
        while (chr === '.' &&
               HEXDIG.test(string.charAt(tokens.cursor + 1))) {
          val += chr;
          chr = string.charAt(++tokens.cursor);
          while (HEXDIG.test(chr)) {
            val += chr;
            chr = string.charAt(++tokens.cursor);
          }
        }
      } else if (chr === '-' &&
                 HEXDIG.test(string.charAt(tokens.cursor + 1))) {
        val += chr;
        chr = string.charAt(++tokens.cursor);
        while (HEXDIG.test(chr)) {
          val += chr;
          chr = string.charAt(++tokens.cursor);
        }
      }

      tokens.push({
        type: 'hex-val',
        value: val
      });
      return true;
    }
    return false;
  }
  return false;
};

var extractProseVal = function (string, tokens) {
  var chr = string.charAt(tokens.cursor),
      str = '',
      code;
  if (chr === '<') {
    while (true) {
      chr = string.charAt(++tokens.cursor);
      code = chr.charCodeAt(0);
      if (code >= 0x20 && code <= 0x3D) {
        str += chr;
      } else if (code >= 0x3F && code <= 0x7E) {
        str += chr;
      } else if (chr === DQUOTE || chr === '') {
        break;
      } else {
        throw new Error("Invalid prose value '%@'".fmt(chr));
      }
    }

    if (chr === '>') {
      tokens.push({
        type: 'prose-val',
        value: str
      });
      tokens.cursor++;
      return true;
    } else {
      return false;
    }
  }
  return false;
};

// .............................................
// PARSER TREE NORMALIZATION
//

var nodeForPath = function (node, path) {
  var token,
      len, i;
  while ((token = path.shift())) {
    len = node && node.value && node.value.length || 0;
    if (len === 0) break;
    for (i = 0; i < len; i++) {
      if (node.value[i].type === token) {
        node = node.value[i];
        break;
      }
    }
  }
  return node;
};

/**
  Walk through the token tree and normalize the
  tokens into simpler forms.

  In particular, this will combine all adjacent
  comments and combine them into a single one
  and normalize incremental alternatives into
  plain alternatives.
 */
var normalizeTree = function (tree) {
  var i, len = tree.length,
      rules = {}, ruleName,
      definedAs,
      oldDefinedAs,
      rule;

  for (i = 0; i < len; i++) {
    rule = tree[i];
    ruleName = nodeForPath(rule, ['rulename']).value;
    if (rules[ruleName] != null) {
      definedAs = nodeForPath(rule, ['defined-as']).value;
      oldDefinedAs = nodeForPath(rules[ruleName], ['defined-as']).value;
      if (definedAs === '=/' && oldDefinedAs === '=') {
        var alternation = nodeForPath(rules[ruleName], ['elements', 'alternation']);
        alternation.value = alternation.value
          .concat(nodeForPath(rule, ['elements', 'alternation']).value);
      } else {
        rules[ruleName] = rule;
      }
    } else {
      rules[ruleName] = rule;
    }
  }

  tree = [];
  for (rule in rules) {
    if (rules.hasOwnProperty(rule)) {
      tree.push(rules[rule]);
    }
  }
  return tree;
};


// .............................................
// PARSER TREE COMPILATION
//

var compileTree = function (tree, state) {
  var funcs = [],
      i, len = tree.length,
      node;

  state.indentation = '\t';

  for (i = 0; i < len; i++) {
    funcs.push(compileRule(tree[i], state));
  }
  return '{\n' + funcs.join(',\n') + '\n}';
};

var compileRule = function (node, state) {
  var ruleName = node.value[0].value,
      elements = node.value[2].value,
      func = '';

  func += state.indentation + '"' + ruleName + '": function () {';
  state.indentation += '\t';
  func += compileElements(elements, state);
  state.indentation.slice(0, -2);

  return func + '\n' + state.indentation + '}';
};

/**
  Augmented BNF parser for JavaScript.
  @see http://tools.ietf.org/html/rfc2234
 */
var ABNF = function (abnf) {
  this.tokens = normalizeTree(extractRuleList(abnf));
};

ABNF.prototype = {
  compile: function () {
    return compileTree(this.tokens, { stack: [] });
  },
  evaluate: function (input) {
    this.grammar.evaluate(input);
  }
};
ABNF.tokenize = extractRuleList;

exports.ABNF = ABNF;
}(this));
