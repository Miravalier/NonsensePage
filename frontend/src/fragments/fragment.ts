export const Fragments: { [name: string]: string } = {};

export function RegisterFragment(name: string, content: string) {
    Fragments[name] = content;
}
