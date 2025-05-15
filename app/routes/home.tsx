import type { Route } from './+types/home';

export function meta({}: Route.MetaArgs) {
    return [
        { title: 'Music Auto Play' },
        { name: 'description', content: 'Welcome to Music Auto Play!' },
    ];
}

export default function Home() {
    return (
        <div>
            Hello World!
        </div>
    );
}
