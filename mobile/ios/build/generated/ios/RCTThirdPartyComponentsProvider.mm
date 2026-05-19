/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */


#import <Foundation/Foundation.h>

#import "RCTThirdPartyComponentsProvider.h"
#import <React/RCTComponentViewProtocol.h>

@implementation RCTThirdPartyComponentsProvider

+ (NSDictionary<NSString *, Class<RCTComponentViewProtocol>> *)thirdPartyFabricComponents
{
  static NSDictionary<NSString *, Class<RCTComponentViewProtocol>> *thirdPartyComponents = nil;
  static dispatch_once_t nativeComponentsToken;

  dispatch_once(&nativeComponentsToken, ^{
    thirdPartyComponents = @{
		@"RNGestureHandlerButton": NSClassFromString(@"RNGestureHandlerButtonComponentView"), // react-native-gesture-handler
		@"RNMBXAtmosphere": NSClassFromString(@"RNMBXAtmosphereComponentView"), // @rnmapbox/maps
		@"RNMBXBackgroundLayer": NSClassFromString(@"RNMBXBackgroundLayerComponentView"), // @rnmapbox/maps
		@"RNMBXCallout": NSClassFromString(@"RNMBXCalloutComponentView"), // @rnmapbox/maps
		@"RNMBXCameraGestureObserver": NSClassFromString(@"RNMBXCameraGestureObserverComponentView"), // @rnmapbox/maps
		@"RNMBXCamera": NSClassFromString(@"RNMBXCameraComponentView"), // @rnmapbox/maps
		@"RNMBXCircleLayer": NSClassFromString(@"RNMBXCircleLayerComponentView"), // @rnmapbox/maps
		@"RNMBXCustomLocationProvider": NSClassFromString(@"RNMBXCustomLocationProviderComponentView"), // @rnmapbox/maps
		@"RNMBXFillExtrusionLayer": NSClassFromString(@"RNMBXFillExtrusionLayerComponentView"), // @rnmapbox/maps
		@"RNMBXFillLayer": NSClassFromString(@"RNMBXFillLayerComponentView"), // @rnmapbox/maps
		@"RNMBXHeatmapLayer": NSClassFromString(@"RNMBXHeatmapLayerComponentView"), // @rnmapbox/maps
		@"RNMBXHillshadeLayer": NSClassFromString(@"RNMBXHillshadeLayerComponentView"), // @rnmapbox/maps
		@"RNMBXImage": NSClassFromString(@"RNMBXImageComponentView"), // @rnmapbox/maps
		@"RNMBXImageSource": NSClassFromString(@"RNMBXImageSourceComponentView"), // @rnmapbox/maps
		@"RNMBXImages": NSClassFromString(@"RNMBXImagesComponentView"), // @rnmapbox/maps
		@"RNMBXLight": NSClassFromString(@"RNMBXLightComponentView"), // @rnmapbox/maps
		@"RNMBXLineLayer": NSClassFromString(@"RNMBXLineLayerComponentView"), // @rnmapbox/maps
		@"RNMBXMapView": NSClassFromString(@"RNMBXMapViewComponentView"), // @rnmapbox/maps
		@"RNMBXMarkerViewContent": NSClassFromString(@"RNMBXMarkerViewContentComponentView"), // @rnmapbox/maps
		@"RNMBXMarkerView": NSClassFromString(@"RNMBXMarkerViewComponentView"), // @rnmapbox/maps
		@"RNMBXModelLayer": NSClassFromString(@"RNMBXModelLayerComponentView"), // @rnmapbox/maps
		@"RNMBXModels": NSClassFromString(@"RNMBXModelsComponentView"), // @rnmapbox/maps
		@"RNMBXNativeUserLocation": NSClassFromString(@"RNMBXNativeUserLocationComponentView"), // @rnmapbox/maps
		@"RNMBXPointAnnotation": NSClassFromString(@"RNMBXPointAnnotationComponentView"), // @rnmapbox/maps
		@"RNMBXRain": NSClassFromString(@"RNMBXRainComponentView"), // @rnmapbox/maps
		@"RNMBXRasterArraySource": NSClassFromString(@"RNMBXRasterArraySourceComponentView"), // @rnmapbox/maps
		@"RNMBXRasterDemSource": NSClassFromString(@"RNMBXRasterDemSourceComponentView"), // @rnmapbox/maps
		@"RNMBXRasterLayer": NSClassFromString(@"RNMBXRasterLayerComponentView"), // @rnmapbox/maps
		@"RNMBXRasterParticleLayer": NSClassFromString(@"RNMBXRasterParticleLayerComponentView"), // @rnmapbox/maps
		@"RNMBXRasterSource": NSClassFromString(@"RNMBXRasterSourceComponentView"), // @rnmapbox/maps
		@"RNMBXShapeSource": NSClassFromString(@"RNMBXShapeSourceComponentView"), // @rnmapbox/maps
		@"RNMBXSkyLayer": NSClassFromString(@"RNMBXSkyLayerComponentView"), // @rnmapbox/maps
		@"RNMBXSnow": NSClassFromString(@"RNMBXSnowComponentView"), // @rnmapbox/maps
		@"RNMBXStyleImport": NSClassFromString(@"RNMBXStyleImportComponentView"), // @rnmapbox/maps
		@"RNMBXSymbolLayer": NSClassFromString(@"RNMBXSymbolLayerComponentView"), // @rnmapbox/maps
		@"RNMBXTerrain": NSClassFromString(@"RNMBXTerrainComponentView"), // @rnmapbox/maps
		@"RNMBXVectorSource": NSClassFromString(@"RNMBXVectorSourceComponentView"), // @rnmapbox/maps
		@"RNMBXViewport": NSClassFromString(@"RNMBXViewportComponentView"), // @rnmapbox/maps
    };
  });

  return thirdPartyComponents;
}

@end
