#!/bin/bash

declare -A dependencies

dependencies.variables() {
    dependencies["pattern"]="package.json"
    dependencies["ignore"]="node_modules"
}

dependencies.clear() {
    local dirs=()
    while IFS= read -r dir; do
        if [[ $dir == *"${dependencies["ignore"]}"* ]]; then
            dirs+=("$dir")
        fi
    done < <(find . -type d -name "node_modules")

    if [[ ${#dirs[@]} -eq 0 ]]; then
        printf "No dependencies found. Exiting...\n"
        return
    fi

    for dir in "${dirs[@]}"; do
        printf "Clearing dependencies in %s...\n" "$dir"
        rm -rf "$dir"
    done
}

dependencies.install() {
    printf "Installing dependencies...\n"

    while IFS= read -r file; do
        if [[ $file == *"${dependencies["ignore"]}"* ]]; then
            continue
        fi

        directory=$(dirname "$file")
        
        printf "Processing directory: %s\n" "$directory"
        (cd "$directory" && npm install)
    done < <(find ./ -name "${dependencies["pattern"]}" 2>/dev/null)
}

dependencies.options() {
    read -r -p "Do you want to install dependencies? (y/n): " install_dependencies

    case ${install_dependencies} in
    y)
        dependencies.install
        ;;
    n)
        printf "Exiting...\n"
        ;;
    *)
        printf "Invalid option\n"
        dependencies.options
        ;;
    esac
}

dependencies.variables

dependencies.clear "$@"
dependencies.options "$@"
