import '../setup';
import { renderToStaticMarkup } from 'react-dom/server';
import Popup from '../../youtube-auto-play/src/popup/popup';
import { test } from '../bunTestCompat';

test('renders popup', () => {
    const html = renderToStaticMarkup(<Popup />);
    expect(html).toContain('URLリスト');
});
function expect(html: string): { toContain: (substr: string) => void } {
    return {
        toContain(substr: string) {
            if (!html.includes(substr))
                throw new Error(`Expected string to contain "${substr}", but it did not.\nReceived: ${html}`);
        },
    };
}
