import { Vector2 } from "./vector.js";


export function Bound(min, value, max) {
    return Math.min(Math.max(min, value), max);
}


export function IsDefined(value) {
    return typeof (value) !== "undefined";
}


export function PageCenter() {
    return new Vector2(window.innerWidth, window.innerHeight);
}


export function Parameter() {
    for (let argument of arguments) {
        if (typeof (argument) !== "undefined") {
            return argument;
        }
    }
    return undefined;
}


export function Require(argument) {
    if (typeof (argument) === "undefined") {
        throw new Error("Required parameter missing.")
    }
    return argument;
}

export function LoremIpsum() {
    return `
        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt
        ut labore et dolore magna aliqua. Elementum curabitur vitae nunc sed velit dignissim
        sodales ut eu. Porta nibh venenatis cras sed felis eget velit. Metus aliquam eleifend mi
        in nulla posuere sollicitudin aliquam ultrices. Eu turpis egestas pretium aenean.
        Adipiscing elit duis tristique sollicitudin nibh sit amet. Amet est placerat in egestas.
        Potenti nullam ac tortor vitae purus faucibus ornare suspendisse sed. Nulla aliquet enim
        tortor at auctor urna nunc id cursus. Egestas sed tempus urna et. Vestibulum lectus mauris
        ultrices eros in cursus turpis. Odio ut sem nulla pharetra diam sit. Eu non diam phasellus
        vestibulum lorem. Est pellentesque elit ullamcorper dignissim cras tincidunt. Fames ac
        turpis egestas sed. Auctor neque vitae tempus quam pellentesque nec nam aliquam.
        Viverra mauris in aliquam sem fringilla ut. Arcu dictum varius duis at. Convallis convallis
        tellus id interdum velit laoreet. Sed cras ornare arcu dui vivamus arcu felis bibendum.
        Faucibus purus in massa tempor nec feugiat nisl pretium. Cursus vitae congue mauris rhoncus
        aenean vel elit. Lacus luctus accumsan tortor posuere. Lacus sed viverra tellus in hac.
        Viverra orci sagittis eu volutpat odio facilisis mauris. Cursus eget nunc scelerisque
        viverra mauris in aliquam sem fringilla. Quis risus sed vulputate odio ut enim blandit
        volutpat maecenas. Libero enim sed faucibus turpis in. Praesent tristique magna sit amet
        purus. Amet nisl suscipit adipiscing bibendum est ultricies.
        Vel facilisis volutpat est velit egestas dui id ornare. Egestas erat imperdiet sed euismod
        nisi porta lorem. Congue nisi vitae suscipit tellus mauris a. Semper feugiat nibh sed
        pulvinar proin gravida hendrerit lectus. Volutpat maecenas volutpat blandit aliquam etiam
        erat. Cras tincidunt lobortis feugiat vivamus at augue eget arcu dictum. Sit amet dictum
        sit amet. Dis parturient montes nascetur ridiculus mus mauris. Hendrerit dolor magna eget
        est lorem. Feugiat nisl pretium fusce id velit ut tortor pretium viverra. Mi bibendum neque
        egestas congue quisque egestas diam in. Adipiscing commodo elit at imperdiet dui accumsan
        sit. Dictum sit amet justo donec enim diam. Donec et odio pellentesque diam volutpat commodo
        sed. At tellus at urna condimentum mattis pellentesque. Tortor pretium viverra suspendisse
        potenti nullam ac. Mauris cursus mattis molestie a iaculis. Orci porta non pulvinar neque
        laoreet suspendisse interdum consectetur libero. Malesuada fames ac turpis egestas integer
        eget aliquet nibh. Sapien nec sagittis aliquam malesuada bibendum.
        In iaculis nunc sed augue. Ut faucibus pulvinar elementum integer enim. Felis eget velit
        aliquet sagittis id. Ornare suspendisse sed nisi lacus sed. Dictum varius duis at consectetur
        lorem. Ut diam quam nulla porttitor massa id. Tempus urna et pharetra pharetra massa. Nunc
        sed velit dignissim sodales ut eu sem integer vitae. Sollicitudin tempor id eu nisl nunc.
        Vitae proin sagittis nisl rhoncus. Tortor id aliquet lectus proin nibh nisl condimentum.
        Eros donec ac odio tempor. Malesuada fames ac turpis egestas maecenas pharetra convallis.
        Malesuada fames ac turpis egestas maecenas pharetra convallis posuere morbi. Diam ut
        venenatis tellus in. Enim facilisis gravida neque convallis a cras semper auctor. In
        tellus integer feugiat scelerisque varius.
        Morbi tristique senectus et netus. Senectus et netus et malesuada fames ac. Ultricies
        mi eget mauris pharetra et ultrices neque ornare. Ante in nibh mauris cursus mattis
        molestie. Blandit massa enim nec dui nunc mattis enim ut. Mi sit amet mauris commodo
        quis imperdiet. Quisque sagittis purus sit amet. Nullam vehicula ipsum a arcu cursus
        vitae congue mauris rhoncus. Tortor dignissim convallis aenean et tortor at risus.
        Amet venenatis urna cursus eget nunc scelerisque. Tempus imperdiet nulla malesuada
        pellentesque elit eget gravida cum. Fusce id velit ut tortor pretium. Vel elit
        scelerisque mauris pellentesque. Risus viverra adipiscing at in. Ac turpis egestas
        sed tempus urna et pharetra pharetra. Senectus et netus et malesuada fames ac turpis
        egestas.
    `;
}
