import * as React from "react";
import { ApplicationWindow } from "./window";


export interface FilesWindowProps {
    id: string;
    onClose: (windowId: string) => void;
    left?: number;
    top?: number;
};
export interface FilesWindowState { };


export class FilesWindow extends React.Component<FilesWindowProps, FilesWindowState> {
    constructor(props: FilesWindowProps) {
        super(props);
        this.state = {};
    }

    render() {
        return (
            <ApplicationWindow className="files" title="Files Window" id={this.props.id}
                width={600} height={400} onClose={(windowId) => this.props.onClose(windowId)}
                left={this.props.left} top={this.props.top}>
                <div>
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque
                    nec dui sit amet metus euismod rutrum quis et nibh. Nullam nec est a
                    quam semper malesuada efficitur ac lorem. Nulla eros est, lacinia
                    sodales sollicitudin vel, dapibus a leo. Curabitur facilisis, dui et
                    convallis vestibulum, dolor ligula molestie lectus, quis lacinia neque
                    ex eu leo. Sed consectetur nunc a neque interdum tempor. Fusce a ornare
                    risus. Ut consectetur odio nulla, vel laoreet leo aliquam non.
                    Donec efficitur porta sem nec elementum. Orci varius natoque penatibus
                    et magnis dis parturient montes, nascetur ridiculus mus. Proin sed dui
                    quis augue rhoncus commodo ut a metus. Nunc suscipit lectus eget massa
                    pulvinar, vel tincidunt purus tincidunt. Quisque congue rhoncus justo,
                    at vehicula massa eleifend eu. Pellentesque nec quam nunc. Nullam a
                    ligula ut odio rutrum viverra. Sed posuere ex ipsum, id elementum
                    tellus elementum nec. Praesent sit amet lacinia metus, blandit
                    convallis lacus. Donec arcu neque, porttitor ac ex vel, imperdiet
                    auctor enim. Mauris vulputate nec sem lacinia aliquet. Aenean convallis
                    pulvinar aliquam. Fusce venenatis vulputate justo, sed sollicitudin
                    diam vestibulum et. Sed quam tellus, placerat sed purus non, bibendum
                    porttitor odio.
                    Proin auctor massa sit amet dolor pulvinar, sed semper tortor rutrum.
                    Vestibulum sed tellus facilisis, vulputate urna vel, fringilla magna.
                    Integer massa nisl, auctor nec nunc a, cursus placerat ligula. Quisque
                    sed ornare nisi. Nulla nec ipsum lectus. Sed enim ante, viverra at
                    elementum ut, auctor varius leo. Sed viverra maximus erat sed facilisis.
                    Etiam vitae odio sed diam imperdiet congue. Aliquam eleifend a mi et
                    volutpat.
                    Suspendisse molestie ex eget orci facilisis efficitur. Nunc quis orci
                    in urna faucibus accumsan nec id turpis. Donec at justo libero. Mauris
                    sit amet massa ullamcorper, rhoncus libero non, tristique sem. Quisque
                    eget tincidunt nunc. Curabitur vestibulum facilisis metus, eget rutrum
                    enim aliquam sed. Duis interdum turpis volutpat libero mattis interdum
                    ut eget felis. Pellentesque scelerisque urna ex, non hendrerit quam
                    ultricies ultricies. Mauris lacinia vestibulum leo et bibendum. Quisque
                    efficitur vitae dolor quis auctor. Maecenas quis arcu orci. Curabitur
                    mattis elementum dui ac auctor.
                    Curabitur et pellentesque ante. Quisque sit amet auctor neque, sed
                    faucibus justo. Integer nec pellentesque dui. Proin ornare, diam ac
                    lacinia pulvinar, sapien purus scelerisque ante, vel facilisis justo
                    erat et eros. Morbi ut felis turpis. Quisque id varius velit, sit amet
                    euismod augue. Suspendisse potenti. Donec accumsan varius porttitor.
                    Cras pharetra felis a massa lobortis iaculis.
                </div>
            </ApplicationWindow>
        );
    }
}
