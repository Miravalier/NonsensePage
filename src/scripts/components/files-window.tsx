import * as React from "react";

interface FilesWindowProps { }

interface FilesWindowState { }

export class FilesWindow extends React.Component<FilesWindowProps, FilesWindowState> {
    constructor(props: FilesWindowProps) {
        super(props);
    }

    render() {
        return (
            <div className="files window">
                Files Window
            </div>
        );
    }
}
