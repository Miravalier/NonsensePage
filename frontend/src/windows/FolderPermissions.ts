import { registerWindowType } from "./Window.ts";
import { ApiRequest } from "../lib/Requests.ts";
import { Permission } from "../lib/Models.ts";
import { PermissionsWindow } from "./Permissions.ts";


export class FolderPermissionsWindow extends PermissionsWindow {
    async getPermissions() {
        this.permissions = { "*": { "*": Permission.Inherit } };
    }

    async setPermissions() {
        await ApiRequest(`/${this.entryType}/folder/update-permissions`, {
            folder_id: this.id,
            permissions: this.permissions,
        });
    }
}


registerWindowType(PermissionsWindow);
