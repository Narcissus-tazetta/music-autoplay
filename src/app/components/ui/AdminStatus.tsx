import { MdAdminPanelSettings } from 'react-icons/md';
import { useAdminStore } from '../../../shared/stores/adminStore';

export const AdminStatus = () => {
    const isAdmin = useAdminStore(s => s.isAdmin);

    if (!isAdmin) return null;

    return (
        <span
            role='status'
            aria-label='管理者モード'
            className='relative inline-flex items-center h-9 pl-9 pr-3 text-sm font-medium rounded-md border border-blue-500 text-blue-600 bg-transparent dark:border-blue-400 dark:text-blue-300'
        >
            <span className='absolute left-3 top-1/2 -translate-y-1/2 text-current'>
                <MdAdminPanelSettings className='w-5 h-5' aria-hidden='true' />
            </span>
            <span className='mx-auto w-28 text-center'>管理者モード</span>
        </span>
    );
};

export default AdminStatus;
