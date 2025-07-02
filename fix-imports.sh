#!/bin/bash

# インポートパス一括修正スクリプト

echo "インポートパスを修正中..."

# src/features/ ディレクトリ内のファイル向け
find src/features -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e 's|~/components/ui/|../../shared/components/|g' \
  -e 's|~/components/footer/Footer|../../shared/components/Footer|g' \
  -e 's|~/components/settings/|../../features/settings/components/|g' \
  -e 's|~/components/home/|../../features/music/components/|g' \
  -e 's|~/components/time/|../../features/schedule/components/|g' \
  -e 's|~/hooks/use-gaming-toggle|../../shared/hooks/use-gaming-toggle|g' \
  -e 's|~/hooks/use-color-mode|../../features/settings/hooks/use-color-mode|g' \
  -e 's|~/hooks/use-mobile|../../shared/hooks/use-mobile|g' \
  -e 's|~/hooks/use-progress-settings|../../features/settings/hooks/use-progress-settings|g' \
  -e 's|~/hooks/use-youtube-status|../../features/music/hooks/use-youtube-status|g' \
  -e 's|~/hooks/use-class-schedule|../../features/schedule/hooks/use-class-schedule|g' \
  -e 's|~/stores/musicStore|../../features/music/stores/musicStore|g' \
  -e 's|~/stores/adminStore|../../shared/stores/adminStore|g' \
  -e 's|~/stores/colorModeStore|../../features/settings/stores/colorModeStore|g' \
  -e 's|~/stores/classScheduleStore|../../features/schedule/stores/classScheduleStore|g' \
  -e 's|~/stores/progressSettingsStore|../../features/settings/stores/progressSettingsStore|g' \
  -e 's|~/libs/|../../shared/libs/|g' \
  -e 's|~/utils/|../../shared/utils/|g' \
  -e 's|~/types/|../../shared/types/|g'

# src/shared/ ディレクトリ内のファイル向け
find src/shared -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e 's|~/components/ui/|../components/|g' \
  -e 's|~/components/footer/Footer|../components/Footer|g' \
  -e 's|~/hooks/|../hooks/|g' \
  -e 's|~/stores/|../stores/|g' \
  -e 's|~/libs/|../libs/|g' \
  -e 's|~/utils/|../utils/|g' \
  -e 's|~/types/|../types/|g'

# src/server/ ディレクトリ内のファイル向け
find src/server -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e 's|~/server/|./|g' \
  -e 's|~/types/|../shared/types/|g' \
  -e 's|~/libs/|../shared/libs/|g' \
  -e 's|~/utils/|../shared/utils/|g'

# src/routes/ ディレクトリ内のファイル向け
find src/routes -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e 's|~/components/ui/|../shared/components/|g' \
  -e 's|~/components/footer/Footer|../shared/components/Footer|g' \
  -e 's|~/components/settings/|../features/settings/components/|g' \
  -e 's|~/components/home/|../features/music/components/|g' \
  -e 's|~/components/time/|../features/schedule/components/|g' \
  -e 's|~/hooks/use-gaming-toggle|../shared/hooks/use-gaming-toggle|g' \
  -e 's|~/hooks/use-color-mode|../features/settings/hooks/use-color-mode|g' \
  -e 's|~/hooks/use-mobile|../shared/hooks/use-mobile|g' \
  -e 's|~/hooks/use-progress-settings|../features/settings/hooks/use-progress-settings|g' \
  -e 's|~/hooks/use-youtube-status|../features/music/hooks/use-youtube-status|g' \
  -e 's|~/hooks/use-class-schedule|../features/schedule/hooks/use-class-schedule|g' \
  -e 's|~/stores/musicStore|../features/music/stores/musicStore|g' \
  -e 's|~/stores/adminStore|../shared/stores/adminStore|g' \
  -e 's|~/stores/colorModeStore|../features/settings/stores/colorModeStore|g' \
  -e 's|~/stores/classScheduleStore|../features/schedule/stores/classScheduleStore|g' \
  -e 's|~/stores/progressSettingsStore|../features/settings/stores/progressSettingsStore|g' \
  -e 's|~/libs/|../shared/libs/|g' \
  -e 's|~/utils/|../shared/utils/|g' \
  -e 's|~/types/|../shared/types/|g'

# src/app/routes/ ディレクトリ内のファイル向け  
find src/app/routes -name "*.tsx" -o -name "*.ts" | xargs sed -i '' \
  -e 's|~/components/ui/|../../shared/components/|g' \
  -e 's|~/components/footer/Footer|../../shared/components/Footer|g' \
  -e 's|~/components/settings/|../../features/settings/components/|g' \
  -e 's|~/components/home/|../../features/music/components/|g' \
  -e 's|~/components/time/|../../features/schedule/components/|g' \
  -e 's|~/hooks/use-gaming-toggle|../../shared/hooks/use-gaming-toggle|g' \
  -e 's|~/hooks/use-color-mode|../../features/settings/hooks/use-color-mode|g' \
  -e 's|~/hooks/use-mobile|../../shared/hooks/use-mobile|g' \
  -e 's|~/hooks/use-progress-settings|../../features/settings/hooks/use-progress-settings|g' \
  -e 's|~/hooks/use-youtube-status|../../features/music/hooks/use-youtube-status|g' \
  -e 's|~/hooks/use-class-schedule|../../features/schedule/hooks/use-class-schedule|g' \
  -e 's|~/stores/musicStore|../../features/music/stores/musicStore|g' \
  -e 's|~/stores/adminStore|../../shared/stores/adminStore|g' \
  -e 's|~/stores/colorModeStore|../../features/settings/stores/colorModeStore|g' \
  -e 's|~/stores/classScheduleStore|../../features/schedule/stores/classScheduleStore|g' \
  -e 's|~/stores/progressSettingsStore|../../features/settings/stores/progressSettingsStore|g' \
  -e 's|~/libs/|../../shared/libs/|g' \
  -e 's|~/utils/|../../shared/utils/|g' \
  -e 's|~/types/|../../shared/types/|g'

echo "インポートパス修正完了！"
