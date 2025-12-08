import { useState } from 'react';

interface UseMusicRowOptions {
    musicId: string;
    requesterHash?: string;
    userHash?: string;
    isAdmin: boolean;
    onDelete: (id: string, isAdmin?: boolean) => void;
}

export function useMusicRow({
    musicId,
    requesterHash,
    userHash,
    isAdmin,
    onDelete,
}: UseMusicRowOptions) {
    const [isExpanded, setIsExpanded] = useState(false);
    const canDelete = isAdmin || (requesterHash && userHash === requesterHash);

    const handleDelete = () => {
        // Pass isAdmin so that server-side admin deletion can be used when the
        // client is in admin mode. Previously the admin flag was never passed
        // which resulted in server rejecting deletion even when `isAdmin` was true
        // on the client.
        onDelete(musicId, isAdmin);
    };

    const toggleExpanded = () => {
        setIsExpanded(prev => !prev);
    };

    return {
        canDelete,
        handleDelete,
        isExpanded,
        toggleExpanded,
    };
}
