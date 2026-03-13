import { Card } from '@shadcn/ui/card';
import { AdminLoginModalContent } from '~/components/ui/AdminLoginModalContent';

export default function AdminPage() {
    return (
        <div className='flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900'>
            <Card className='w-full max-w-md'>
                <Card.Content className='pt-6'>
                    <AdminLoginModalContent />
                </Card.Content>
            </Card>
        </div>
    );
}
