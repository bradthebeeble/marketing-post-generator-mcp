#!/bin/bash

# Docker Build Script for Marketing Post Generator MCP Server
# Builds both development and production Docker images

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="marketing-post-generator-mcp"
VERSION=${VERSION:-"latest"}
BUILD_TARGET=${BUILD_TARGET:-"production"}

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

# Function to build TypeScript (optional - Docker handles this in multi-stage build)
build_typescript() {
    print_info "Building TypeScript locally..."
    if npm run build; then
        print_success "TypeScript build completed"
    else
        print_error "TypeScript build failed"
        exit 1
    fi
}

# Function to build Docker image
build_docker_image() {
    local target=$1
    local tag_suffix=""
    
    if [ "$target" = "builder" ]; then
        tag_suffix="-dev"
    fi
    
    local full_tag="${IMAGE_NAME}:${VERSION}${tag_suffix}"
    
    print_info "Building Docker image: $full_tag (target: $target)"
    
    if docker build \
        --target="$target" \
        --tag="$full_tag" \
        --build-arg="NODE_ENV=${NODE_ENV:-production}" \
        .; then
        print_success "Docker image built successfully: $full_tag"
        
        # Tag as latest if version is not specified
        if [ "$VERSION" = "latest" ]; then
            docker tag "$full_tag" "${IMAGE_NAME}:latest${tag_suffix}"
            print_success "Tagged as latest: ${IMAGE_NAME}:latest${tag_suffix}"
        fi
    else
        print_error "Docker build failed for target: $target"
        exit 1
    fi
}

# Function to display image info
show_image_info() {
    print_info "Docker images created:"
    docker images | grep "$IMAGE_NAME" | head -5
    
    print_info "Image sizes:"
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep "$IMAGE_NAME"
}

# Function to run basic image validation
validate_image() {
    local image_tag="$1"
    print_info "Validating image: $image_tag"
    
    # Test that the image can start
    if docker run --rm --name="${IMAGE_NAME}-test" -d "$image_tag" > /dev/null; then
        sleep 3
        
        # Check if container is still running
        if docker ps | grep "${IMAGE_NAME}-test" > /dev/null; then
            print_success "Image validation passed - container started successfully"
            docker stop "${IMAGE_NAME}-test" > /dev/null
        else
            print_error "Image validation failed - container exited immediately"
            docker logs "${IMAGE_NAME}-test" 2>/dev/null || true
            exit 1
        fi
    else
        print_error "Image validation failed - could not start container"
        exit 1
    fi
}

# Main execution
main() {
    print_info "Starting Docker build process..."
    print_info "Target: $BUILD_TARGET"
    print_info "Version: $VERSION"
    
    # Clean up any existing test containers
    docker rm -f "${IMAGE_NAME}-test" 2>/dev/null || true
    
    # Note: Docker build handles TypeScript compilation in multi-stage build
    # Uncomment the next line if you need local TypeScript artifacts
    # build_typescript
    
    # Build Docker image based on target
    case "$BUILD_TARGET" in
        "production")
            build_docker_image "production"
            validate_image "${IMAGE_NAME}:${VERSION}"
            ;;
        "development")
            build_docker_image "builder"
            validate_image "${IMAGE_NAME}:${VERSION}-dev"
            ;;
        "both")
            build_docker_image "production"
            build_docker_image "builder"
            validate_image "${IMAGE_NAME}:${VERSION}"
            validate_image "${IMAGE_NAME}:${VERSION}-dev"
            ;;
        *)
            print_error "Invalid build target: $BUILD_TARGET"
            print_info "Valid targets: production, development, both"
            exit 1
            ;;
    esac
    
    # Show results
    show_image_info
    
    print_success "Docker build process completed successfully!"
    print_info "To run the container:"
    print_info "  Production: docker run -p 3000:3000 ${IMAGE_NAME}:${VERSION}"
    print_info "  Development: docker run -p 3000:3000 ${IMAGE_NAME}:${VERSION}-dev"
}

# Script usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --target TARGET    Build target (production|development|both) [default: production]"
    echo "  -v, --version VERSION  Image version tag [default: latest]"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  NODE_ENV              Node environment for build [default: production]"
    echo "  BUILD_TARGET          Same as --target option"
    echo "  VERSION               Same as --version option"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Build production image with latest tag"
    echo "  $0 --target both --version 1.2.3     # Build both images with version 1.2.3"
    echo "  $0 --target development               # Build development image only"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            BUILD_TARGET="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Execute main function
main