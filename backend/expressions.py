from __future__ import annotations

import math
import string
from collections import deque
from dataclasses import dataclass, field
from enum import IntEnum

from pcg import engine


class TokenizerState(IntEnum):
    SEEK_ANY = 0
    IDENTIFIER = 1
    OPERATOR = 2
    NUMBER_PRE_DECIMAL = 3
    NUMBER_POST_DECIMAL = 4
    STRING_LITERAL = 5
    STRING_LITERAL_ESCAPE = 6


class UnaryOpState(IntEnum):
    SEEK_OP = 0
    SEEK_UNIT = 1


class BinaryOpState(IntEnum):
    SEEK_FIRST_UNIT = 0
    SEEK_OP = 1
    SEEK_SECOND_UNIT = 2


OPERATOR_CHARACTERS = set(string.punctuation) - {'(', ')'}


EXP_OPERATORS = {'**'}
MULT_OPERATORS = {'*', '/', '%'}
ADD_OPERATORS = {'+', '-'}
SHIFT_OPERATORS = {'<<', '>>'}
BITWISE_OPERATORS = {'&', '|', '^'}
RELATIONAL_OPERATORS = {'<', '<=', '>', '>='}
EQUALITY_OPERATORS = {'==', '!='}
DICE_OPERATORS = {'d'}
UNARY_PREFIX_OPERATORS = {'-'}
UNARY_POSTFIX_OPERATORS = {'!'}


@dataclass(frozen=True)
class Token:
    type: str
    value: str
    index: int


@dataclass
class Tokenizer:
    expression: str
    index: int = 0
    state: TokenizerState = TokenizerState.SEEK_ANY
    tokens: list[Token] = field(default_factory=list)
    current_token: str = None
    current_token_start_index: int = None

    def tokenize(self) -> list[Token]:
        while self.index < len(self.expression):
            self.tokenize_step(self.expression[self.index])
            self.index += 1
        self.tokenize_step('\0')
        return self.tokens

    def tokenize_step(self, character: str):
        if self.state == TokenizerState.SEEK_ANY:
            self.seek_any(character)
        elif self.state == TokenizerState.IDENTIFIER:
            self.seek_identifier(character)
        elif self.state == TokenizerState.OPERATOR:
            self.seek_operator(character)
        elif self.state == TokenizerState.NUMBER_PRE_DECIMAL:
            self.seek_number_pre_decimal(character)
        elif self.state == TokenizerState.NUMBER_POST_DECIMAL:
            self.seek_number_post_decimal(character)
        elif self.state == TokenizerState.STRING_LITERAL:
            self.seek_string_literal(character)
        elif self.state == TokenizerState.STRING_LITERAL_ESCAPE:
            self.seek_string_literal_escape(character)

    def seek_any(self, character: str):
        self.current_token = character
        self.current_token_start_index = self.index
        if character in string.ascii_letters + "_":
            self.state = TokenizerState.IDENTIFIER
        elif character in string.digits:
            self.state = TokenizerState.NUMBER_PRE_DECIMAL
        elif character in '"\'':
            self.state = TokenizerState.STRING_LITERAL
        elif character in '()':
            self.tokens.append(Token('operator', self.current_token, self.current_token_start_index))
            self.state = TokenizerState.SEEK_ANY
        elif character in OPERATOR_CHARACTERS:
            self.state = TokenizerState.OPERATOR
        else:
            self.state = TokenizerState.SEEK_ANY

    def seek_identifier(self, character: str):
        if character in string.ascii_letters + "_":
            self.current_token += character
        else:
            if self.current_token == 'd':
                self.tokens.append(Token('operator', self.current_token, self.current_token_start_index))
            else:
                self.tokens.append(Token('identifier', self.current_token, self.current_token_start_index))
            self.seek_any(character)

    def seek_operator(self, character: str):
        if character in OPERATOR_CHARACTERS:
            self.current_token += character
        else:
            self.tokens.append(Token('operator', self.current_token, self.current_token_start_index))
            self.seek_any(character)

    def seek_number_pre_decimal(self, character: str):
        if character in string.digits:
            self.current_token += character
        elif character == '.':
            self.current_token += character
            self.state = TokenizerState.NUMBER_POST_DECIMAL
        else:
            self.tokens.append(Token('number', self.current_token, self.current_token_start_index))
            self.seek_any(character)

    def seek_number_post_decimal(self, character: str):
        if character in string.digits:
            self.current_token += character
        else:
            if self.current_token[-1] == '.':
                self.tokens.append(Token('number', self.current_token[:-1], self.current_token_start_index))
                self.index -= 2
                self.state = TokenizerState.SEEK_ANY
            else:
                self.tokens.append(Token('number', self.current_token, self.current_token_start_index))
                self.seek_any(character)

    def seek_string_literal(self, character: str):
        if character == '\0':
            raise SyntaxError(f"unclosed string literal, starts at index {self.current_token_start_index}")
        elif character == self.current_token[0]:
            self.tokens.append(Token('string', self.current_token[1:], self.current_token_start_index))
            self.state = TokenizerState.SEEK_ANY
        elif character == '\\':
            self.state = TokenizerState.STRING_LITERAL_ESCAPE
        else:
            self.current_token += character

    def seek_string_literal_escape(self, character: str):
        if character == '\0':
            raise SyntaxError(f"unclosed string literal, starts at index {self.current_token_start_index}")
        self.current_token += character
        self.state = TokenizerState.STRING_LITERAL


@dataclass(frozen=True)
class Node:
    def evaluate(self, values: dict[str, float]) -> float:
        raise NotImplementedError("Node is an abstract base class!")


@dataclass(frozen=True)
class BinaryOperator(Node):
    operator: str
    left: Node
    right: Node

    def evaluate(self, values: dict[str, float]) -> float:
        if self.operator == 'd':
            if isinstance(self.left, BinaryOperator) and self.left.operator == 'd':
                left = self.left.left.evaluate(values)
                right = self.left.right.evaluate(values)
                dice_to_drop = int(self.right.evaluate(values))
            else:
                left = self.left.evaluate(values)
                right = self.right.evaluate(values)
                dice_to_drop = 0

            if left <= 0.0 or right <= 0.0:
                return 0.0

            rolls = []
            for i in range(int(left)):
                rolls.append(1 + engine.rand_below(int(right)))
            rolls.sort(reverse=True)

            while rolls and dice_to_drop:
                rolls.pop()
                dice_to_drop -= 1

            return float(sum(rolls))

        left = self.left.evaluate(values)
        right = self.right.evaluate(values)
        if self.operator == '*':
            return left * right
        elif self.operator == '/':
            return left / right
        elif self.operator == '%':
            return left % right
        elif self.operator == '+':
            return left + right
        elif self.operator == '-':
            return left - right
        elif self.operator == '**':
            return left ** right
        elif self.operator == '<<':
            return float(int(left) << int(right))
        elif self.operator == '>>':
            return float(int(left) >> int(right))
        elif self.operator == '&':
            return float(int(left) & int(right))
        elif self.operator == '|':
            return float(int(left) | int(right))
        elif self.operator == '^':
            return float(int(left) ^ int(right))
        elif self.operator == '<':
            return 1.0 if left < right else 0.0
        elif self.operator == '<=':
            return 1.0 if left <= right else 0.0
        elif self.operator == '>':
            return 1.0 if left > right else 0.0
        elif self.operator == '>=':
            return 1.0 if left >= right else 0.0
        elif self.operator == '==':
            return 1.0 if left == right else 0.0
        elif self.operator == '!=':
            return 1.0 if left != right else 0.0
        else:
            raise NotImplementedError(f"unimplemented binary operator {self.operator}")


@dataclass(frozen=True)
class UnaryOperator(Node):
    operator: str
    operand: Node

    def evaluate(self, values: dict[str, float]) -> float:
        if self.operator == '-':
            return -1 * self.operand.evaluate(values)
        elif self.operator == '!':
            return float(math.factorial(int(self.operand.evaluate(values))))
        else:
            raise NotImplementedError(f"unimplemented unary operator {self.operator}")


@dataclass(frozen=True)
class Identifier(Node):
    identifier: str

    def evaluate(self, values: dict[str, float]) -> float:
        return values[self.identifier]


@dataclass(frozen=True)
class Number(Node):
    value: float

    def evaluate(self, values: dict[str, float]) -> float:
        return self.value


@dataclass(frozen=True)
class Expression(Node):
    root: Node

    @classmethod
    def convert_literals(cls, tokens: list[Token|Node]) -> list[Token|Node]:
        result = []
        for token in tokens:
            if isinstance(token, Node):
                result.append(token)
            elif token.type == "identifier":
                result.append(Identifier(token.value))
            elif token.type == "number":
                result.append(Number(float(token.value)))
            else:
                result.append(token)
        return result

    @classmethod
    def find_subexpressions(cls, tokens: list[Token|Node]) -> list[Token|Node]:
        result = []
        depth = 0
        for index, token in enumerate(tokens):
            if isinstance(token, Token) and token.type == "operator" and token.value == "(":
                if depth == 0:
                    expression_start = index + 1
                depth += 1
            elif isinstance(token, Token) and token.type == "operator" and token.value == ")":
                depth -= 1
                if depth == 0:
                    result.append(cls.parse(tokens[expression_start: index]).root)
            elif depth == 0:
                result.append(token)
        return result

    @classmethod
    def find_prefix_unary_operators_in_set(cls, tokens: list[Token|Node], operators: set[str]) -> list[Token|Node]:
        result = []
        state = UnaryOpState.SEEK_OP
        history = deque([None, None, None])
        for token in tokens:
            if state == UnaryOpState.SEEK_OP:
                if isinstance(token, Token) and token.type == "operator" and token.value in operators:
                    state = UnaryOpState.SEEK_UNIT
            elif state == UnaryOpState.SEEK_UNIT:
                if isinstance(token, Token) and token.type == "operator" and token.value in operators:
                    pass
                elif isinstance(token, Node):
                    if not isinstance(history[-2], Node):
                        operator: Token = result.pop()
                        token = UnaryOperator(operator.value, token)
                        history.pop()
                        history.appendleft(None)
                    state = UnaryOpState.SEEK_OP
                else:
                    state = UnaryOpState.SEEK_OP
            result.append(token)
            history.popleft()
            history.append(token)
        return result

    @classmethod
    def find_postfix_unary_operators_in_set(cls, tokens: list[Token|Node], operators: set[str]) -> list[Token|Node]:
        result = []
        state = UnaryOpState.SEEK_UNIT
        for token in tokens:
            if state == UnaryOpState.SEEK_UNIT:
                if isinstance(token, Node):
                    state = UnaryOpState.SEEK_OP
            elif state == UnaryOpState.SEEK_OP:
                if isinstance(token, Node):
                    pass
                elif isinstance(token, Token) and token.type == "operator" and token.value in operators:
                    operand: Node = result.pop()
                    token = UnaryOperator(token.value, operand)
                    state = UnaryOpState.SEEK_OP
                else:
                    state = UnaryOpState.SEEK_UNIT
            result.append(token)
        return result

    @classmethod
    def find_binary_operators_in_set(cls, tokens: list[Token|Node], operators: set[str]) -> list[Token|Node]:
        result = []
        state = BinaryOpState.SEEK_FIRST_UNIT
        for token in tokens:
            if state == BinaryOpState.SEEK_FIRST_UNIT:
                if isinstance(token, Node):
                    state = BinaryOpState.SEEK_OP
            elif state == BinaryOpState.SEEK_OP:
                if isinstance(token, Token) and token.type == "operator" and token.value in operators:
                    state = BinaryOpState.SEEK_SECOND_UNIT
                elif isinstance(token, Node):
                    pass
                else:
                    state = BinaryOpState.SEEK_FIRST_UNIT
            elif state == BinaryOpState.SEEK_SECOND_UNIT:
                if isinstance(token, Node):
                    operator: Token = result.pop()
                    first_unit: Node = result.pop()
                    token = BinaryOperator(operator.value, first_unit, token)
                    state = BinaryOpState.SEEK_OP
                else:
                    state = BinaryOpState.SEEK_FIRST_UNIT
            result.append(token)
        return result

    @classmethod
    def parse(cls, tokens: list[Token|Node]) -> Expression:
        if not tokens:
            raise SyntaxError("empty expression")

        tokens = cls.convert_literals(tokens)
        tokens = cls.find_subexpressions(tokens)
        tokens = cls.find_binary_operators_in_set(tokens, DICE_OPERATORS)
        tokens = cls.find_postfix_unary_operators_in_set(tokens, UNARY_POSTFIX_OPERATORS)
        tokens = cls.find_prefix_unary_operators_in_set(tokens, UNARY_PREFIX_OPERATORS)
        tokens = cls.find_binary_operators_in_set(tokens, EXP_OPERATORS)
        tokens = cls.find_binary_operators_in_set(tokens, MULT_OPERATORS)
        tokens = cls.find_binary_operators_in_set(tokens, ADD_OPERATORS)
        tokens = cls.find_binary_operators_in_set(tokens, SHIFT_OPERATORS)
        tokens = cls.find_binary_operators_in_set(tokens, RELATIONAL_OPERATORS)
        tokens = cls.find_binary_operators_in_set(tokens, EQUALITY_OPERATORS)
        tokens = cls.find_binary_operators_in_set(tokens, BITWISE_OPERATORS)

        if len(tokens) > 1:
            raise SyntaxError("too many tokens after parsing")

        return Expression(tokens[0])

    def evaluate(self, values: dict[str, float]) -> float:
        return self.root.evaluate(values)


def evaluate(expression: str, values: dict[str, float] = None) -> float:
    if values is None:
        values = {}

    tokens = Tokenizer(expression).tokenize()
    return Expression.parse(tokens).evaluate(values)
