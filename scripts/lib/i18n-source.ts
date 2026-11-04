// 訳の指紋は、指定したレクチャーの名前付き export の直下だけを書き換える。
// コメント・台詞・入れ子・別の export は触らない。場所を一意に決められない書き方は止める。
import { parse } from '@babel/parser';

export function stampSource(source: string, id: string, fingerprint: string): string {
  if (!/^[A-Z]\d{2}$/.test(id) || !/^[0-9a-f]{12}$/.test(fingerprint))
    throw new Error('レクチャー ID または訳の指紋の形式が合わない');
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript'] });
  const targets = ast.program.body.flatMap((statement) =>
    statement.type === 'ExportNamedDeclaration' && statement.declaration?.type === 'VariableDeclaration'
      ? statement.declaration.declarations.filter(
          (declaration) => declaration.id.type === 'Identifier' && declaration.id.name === id,
        )
      : [],
  );
  const target = targets[0];
  if (targets.length !== 1 || !target) throw new Error(`${id}: 名前付き export を一意に決められない`);
  let object = target.init;
  while (
    object &&
    (object.type === 'TSAsExpression' ||
      object.type === 'TSSatisfiesExpression' ||
      object.type === 'TSTypeAssertion' ||
      object.type === 'TSNonNullExpression' ||
      object.type === 'ParenthesizedExpression')
  )
    object = object.expression;
  if (object?.type !== 'ObjectExpression') throw new Error(`${id}: export は直接書いたオブジェクトにする`);
  // 展開や計算したキーが source を上書きし得るときは、静的な印の場所を決められない。
  if (object.properties.some((property) => property.type === 'SpreadElement' || property.computed))
    throw new Error(`${id}: 指紋を書くオブジェクトでは展開や計算したキーを使えない`);
  const fields = object.properties.filter(
    (property) =>
      property.type !== 'SpreadElement' &&
      ((property.key.type === 'Identifier' && property.key.name === 'source') ||
        (property.key.type === 'StringLiteral' && property.key.value === 'source')),
  );
  const field = fields[0];
  if (fields.length !== 1 || field?.type !== 'ObjectProperty' || field.value.type !== 'StringLiteral')
    throw new Error(`${id}: 直下の source は文字列で 1 つだけ書く`);
  const { start, end } = field.value;
  if (start == null || end == null) throw new Error(`${id}: source の位置が読めない`);
  // 引用符もそのままにし、値の中身だけを置き換える（AST の位置は JS 文字列と同じ UTF-16）。
  return source.slice(0, start + 1) + fingerprint + source.slice(end - 1);
}
