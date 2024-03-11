IMAGE="tsc"

cd $(dirname -- "$(readlink -f -- $0)")

set -euxo pipefail

docker build . --tag "$IMAGE:latest"
