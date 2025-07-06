#!/bin/bash

# Docker Cleanup Script for Marketing Post Generator MCP Server
# Cleans up containers, images, and volumes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="marketing-post-generator-mcp"
COMPOSE_FILE=${COMPOSE_FILE:-"docker-compose.yml"}

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to confirm action
confirm_action() {
    local message="$1"
    local force="$2"
    
    if [ "$force" = "true" ]; then
        return 0
    fi
    
    echo -e "${YELLOW}⚠️  $message${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled"
        return 1
    fi
    return 0
}

# Function to stop and remove containers
cleanup_containers() {
    local force="$1"
    
    print_info "Cleaning up containers..."
    
    # Stop all containers from compose file
    if [ -f "$COMPOSE_FILE" ]; then
        if confirm_action "Stop all services defined in $COMPOSE_FILE?" "$force"; then
            docker-compose -f "$COMPOSE_FILE" down --remove-orphans
            print_success "Compose services stopped and removed"
        fi
    fi
    
    # Find and remove any remaining containers with our image
    local containers; containers=$(docker ps -a --filter "ancestor=$IMAGE_NAME" --format "{{.ID}}" 2>/dev/null || true)
    if [ -n "$containers" ]; then
        if confirm_action "Remove remaining containers using $IMAGE_NAME image?" "$force"; then
            echo "$containers" | xargs docker rm -f
            print_success "Remaining containers removed"
        fi
    else
        print_info "No additional containers found"
    fi
}

# Function to remove images
cleanup_images() {
    local force="$1"
    local remove_all="$2"
    
    print_info "Cleaning up images..."
    
    if [ "$remove_all" = "true" ]; then
        # Remove all images with our name
        local images; images=$(docker images "$IMAGE_NAME" --format "{{.ID}}" 2>/dev/null || true)
        if [ -n "$images" ]; then
            if confirm_action "Remove ALL $IMAGE_NAME images?" "$force"; then
                echo "$images" | xargs docker rmi -f
                print_success "All images removed"
            fi
        else
            print_info "No images found to remove"
        fi
    else
        # Remove only untagged/dangling images
        local dangling; dangling=$(docker images -f "dangling=true" --format "{{.ID}}" 2>/dev/null || true)
        if [ -n "$dangling" ]; then
            if confirm_action "Remove dangling images?" "$force"; then
                echo "$dangling" | xargs docker rmi -f
                print_success "Dangling images removed"
            fi
        else
            print_info "No dangling images found"
        fi
    fi
}

# Function to remove volumes
cleanup_volumes() {
    local force="$1"
    local remove_data="$2"
    
    print_info "Cleaning up volumes..."
    
    if [ "$remove_data" = "true" ]; then
        # Remove named volumes from compose file
        if [ -f "$COMPOSE_FILE" ]; then
            if confirm_action "Remove persistent data volumes? (THIS WILL DELETE ALL DATA)" "$force"; then
                docker-compose -f "$COMPOSE_FILE" down --volumes
                print_success "Data volumes removed"
            fi
        fi
    else
        # Remove only anonymous volumes
        local anonymous; anonymous=$(docker volume ls -f "dangling=true" -q 2>/dev/null || true)
        if [ -n "$anonymous" ]; then
            if confirm_action "Remove anonymous volumes?" "$force"; then
                echo "$anonymous" | xargs docker volume rm
                print_success "Anonymous volumes removed"
            fi
        else
            print_info "No anonymous volumes found"
        fi
    fi
}

# Function to clean up networks
cleanup_networks() {
    local force="$1"
    
    print_info "Cleaning up networks..."
    
    # Remove unused networks
    local unused; unused=$(docker network ls --filter "dangling=true" -q 2>/dev/null || true)
    if [ -n "$unused" ]; then
        if confirm_action "Remove unused networks?" "$force"; then
            echo "$unused" | xargs docker network rm
            print_success "Unused networks removed"
        fi
    else
        print_info "No unused networks found"
    fi
}

# Function to show current status
show_status() {
    print_info "Current Docker Status:"
    echo ""
    
    print_info "Running Containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -E "(NAMES|$IMAGE_NAME)" || echo "No containers running"
    echo ""
    
    print_info "Available Images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep -E "(REPOSITORY|$IMAGE_NAME)" || echo "No images found"
    echo ""
    
    if [ -f "$COMPOSE_FILE" ]; then
        print_info "Compose Services:"
        docker-compose -f "$COMPOSE_FILE" ps 2>/dev/null || echo "No compose services"
        echo ""
    fi
    
    print_info "System Resource Usage:"
    docker system df
    echo ""
}

# Function to perform full system cleanup
full_cleanup() {
    local force="$1"
    
    print_warning "This will perform a comprehensive cleanup!"
    
    if confirm_action "Proceed with full cleanup? (containers, images, volumes, networks)" "$force"; then
        cleanup_containers "$force"
        cleanup_images "$force" "true"
        cleanup_volumes "$force" "false"  # Don't remove data by default in full cleanup
        cleanup_networks "$force"
        
        # Also run Docker system prune
        if confirm_action "Run Docker system prune to free additional space?" "$force"; then
            docker system prune -f
            print_success "System prune completed"
        fi
        
        print_success "Full cleanup completed"
    fi
}

# Script usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  containers   Remove containers only"
    echo "  images       Remove images (dangling by default)"
    echo "  volumes      Remove volumes (anonymous by default)"
    echo "  networks     Remove unused networks"
    echo "  full         Full cleanup (containers, images, volumes, networks)"
    echo "  status       Show current Docker status"
    echo "  help         Show this help message"
    echo ""
    echo "Options:"
    echo "  -f, --force          Don't prompt for confirmation"
    echo "  -a, --all-images     Remove all images (not just dangling)"
    echo "  -d, --data           Include data volumes in cleanup (DESTRUCTIVE)"
    echo "  -c, --compose-file   Docker compose file [default: docker-compose.yml]"
    echo ""
    echo "Environment variables:"
    echo "  COMPOSE_FILE         Same as --compose-file option"
    echo ""
    echo "Examples:"
    echo "  $0 status                    # Show current status"
    echo "  $0 containers                # Remove containers with confirmation"
    echo "  $0 images --all-images       # Remove all images"
    echo "  $0 full --force              # Full cleanup without confirmation"
    echo "  $0 volumes --data --force    # Remove all volumes including data"
    echo ""
    echo "⚠️  WARNING: Some operations are destructive and will delete data!"
}

# Main function
main() {
    local command="$1"
    local force="false"
    local all_images="false"
    local include_data="false"
    
    # Parse options
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                force="true"
                shift
                ;;
            -a|--all-images)
                all_images="true"
                shift
                ;;
            -d|--data)
                include_data="true"
                shift
                ;;
            -c|--compose-file)
                COMPOSE_FILE="$2"
                shift 2
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Execute command
    case "$command" in
        "containers")
            cleanup_containers "$force"
            ;;
        "images")
            cleanup_images "$force" "$all_images"
            ;;
        "volumes")
            cleanup_volumes "$force" "$include_data"
            ;;
        "networks")
            cleanup_networks "$force"
            ;;
        "full")
            full_cleanup "$force"
            ;;
        "status")
            show_status
            ;;
        "help"|"")
            usage
            ;;
        *)
            print_error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Check if Docker is available
if ! command -v docker > /dev/null 2>&1; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

# Execute main function with all arguments
main "$@"