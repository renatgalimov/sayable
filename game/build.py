"""Build a self-contained phrase-v8 game from the shared model."""
import argparse
import json
from pathlib import Path

import origins

HERE = Path(__file__).resolve().parent


def build():
    model = json.loads((HERE.parent / 'models/phrase-v8.json').read_text(encoding='utf-8'))
    assert model['version'] == 'phrase-v8'
    assert len(model['begin']) == 128 and len(model['contexts']) == 640
    assert all(len(row) == 64 for row in model['middle'])
    assert all(len(row) == 32 for row in model['end32'])
    template = (HERE / 'space-game.template.html').read_text(encoding='utf-8')
    for placeholder, content in (
        ('__MODEL__', json.dumps(model, separators=(',', ':')).replace('</', '\\u003c/')),
        ('__ORIGINS__', json.dumps(origins.build(model), separators=(',', ':')).replace('</', '\\u003c/')),
        ('__LOGIC__', (HERE / 'logic.cjs').read_text(encoding='utf-8')),
        ('__APP__', (HERE / 'app.js').read_text(encoding='utf-8')),
    ):
        assert template.count(placeholder) == 1
        template = template.replace(placeholder, content)
    return template


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('output', nargs='?', type=Path, default=HERE / 'space-game.html')
    args = parser.parse_args()
    result = build().encode('utf-8')
    if args.check:
        if args.output.read_bytes() != result:
            parser.exit(1, 'Game differs from the generated output.\n')
    else:
        args.output.write_bytes(result)
    print(f'{"Checked" if args.check else "Built"}: {args.output}')


if __name__ == '__main__':
    main()
