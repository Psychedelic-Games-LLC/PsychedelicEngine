import { World } from '@xrengine/engine/src/ecs/classes/World'
import { addComponent, getComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { PersistTagComponent } from '@xrengine/engine/src/scene/components/PersistTagComponent'
import { XRUIComponent } from '@xrengine/engine/src/xrui/components/XRUIComponent'
import { ObjectFitFunctions } from '@xrengine/engine/src/xrui/functions/ObjectFitFunctions'
import { WidgetName, Widgets } from '@xrengine/engine/src/xrui/Widgets'

import SettingsIcon from '@mui/icons-material/Settings'

import { createSettingDetailView } from './ui/SettingDetailView'

export function createSettingsWidget(world: World) {
  const ui = createSettingDetailView()

  addComponent(ui.entity, PersistTagComponent, true)

  const xrui = getComponent(ui.entity, XRUIComponent)
  ObjectFitFunctions.setUIVisible(xrui.container, false)

  Widgets.registerWidget(world, ui.entity, {
    ui,
    label: WidgetName.SETTINGS,
    icon: SettingsIcon,
    system: () => {}
  })
}
