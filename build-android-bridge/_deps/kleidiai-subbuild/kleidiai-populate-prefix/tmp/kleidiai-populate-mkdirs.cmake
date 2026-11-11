# Distributed under the OSI-approved BSD 3-Clause License.  See accompanying
# file Copyright.txt or https://cmake.org/licensing for details.

cmake_minimum_required(VERSION ${CMAKE_VERSION}) # this file comes with cmake

# If CMAKE_DISABLE_SOURCE_CHANGES is set to true and the source directory is an
# existing directory in our source tree, calling file(MAKE_DIRECTORY) on it
# would cause a fatal error, even though it would be a no-op.
if(NOT EXISTS "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-src")
  file(MAKE_DIRECTORY "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-src")
endif()
file(MAKE_DIRECTORY
  "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-build"
  "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-subbuild/kleidiai-populate-prefix"
  "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-subbuild/kleidiai-populate-prefix/tmp"
  "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-subbuild/kleidiai-populate-prefix/src/kleidiai-populate-stamp"
  "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-subbuild/kleidiai-populate-prefix/src"
  "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-subbuild/kleidiai-populate-prefix/src/kleidiai-populate-stamp"
)

set(configSubDirs )
foreach(subDir IN LISTS configSubDirs)
    file(MAKE_DIRECTORY "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-subbuild/kleidiai-populate-prefix/src/kleidiai-populate-stamp/${subDir}")
endforeach()
if(cfgdir)
  file(MAKE_DIRECTORY "/workspaces/llm-chat-app-template/build-android-bridge/_deps/kleidiai-subbuild/kleidiai-populate-prefix/src/kleidiai-populate-stamp${cfgdir}") # cfgdir has leading slash
endif()
